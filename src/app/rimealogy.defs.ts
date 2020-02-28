function findText(from: Element, name: string): string {
    const val = findTextOrNull(from, name);
    if (!val) {
        throw new TypeError('Node or textContent was null');
    }
    return val;
}

function findTextOrNull(from: Element, name: string): string | null {
    return from.querySelector(':scope>' + name)?.textContent || null;
}

export class Pawn {
    readonly id: string;
    readonly name: Name;
    readonly def: string;
    readonly kindDef: string;
    readonly alive: boolean;
    readonly gender: 'male' | 'female';
    readonly faction: Faction | null;
    readonly seen: boolean;
    readonly relations: { [other: string]: string };

    constructor(readonly game: Game, data: Element) {
        this.id = findText(data, 'id');
        this.name = new Name(data.querySelector(':scope>name')!!);
        this.def = findText(data, 'def');
        this.gender = findTextOrNull(data, 'gender') === 'Female' ? 'female' : 'male';
        const factionID = data.querySelector('faction')?.textContent;
        if (factionID) {
            this.faction = game.factions[factionID];
        } else {
            this.faction = null;
        }
        this.alive = findTextOrNull(data, 'healthTracker>healthState') !== 'Dead';
        const social = data.querySelector(':scope>social')!!;
        this.seen = findTextOrNull(social, 'everSeenByPlayer') !== 'False';
        this.relations = {};
        Array.from(social.querySelectorAll(':scope>directRelations>li'))
            .map((rel) => [findText(rel, 'otherPawn'), findText(rel, 'def')])
            .filter((rel) => rel[0].includes('Human'))
            .forEach((rel) => this.relations[rel[0]] = rel[1]);
    }
}

export class Name {
    readonly first: string;
    readonly last: string;
    readonly nick: string;
    readonly type: 'single' | 'triple' | 'null';

    constructor(data: Element) {
        if (data.getAttribute('IsNull') === 'True') {
            this.type = 'null';
            this.first = this.nick = this.last = '???';
        } else if (data.getAttribute('Class') === 'NameTriple') {
            this.type = 'triple';
            this.first = findText(data, 'first');
            this.last = findText(data, 'last');
            this.nick = findText(data, 'nick');
        } else if (data.getAttribute('Class') === 'NameSingle') {
            this.type = 'single';
            this.first = this.last = '';
            this.nick = findText(data, 'name');
        } else {
            throw new Error('Unknown name node type');
        }
    }

    get fullName(): string {
        switch (this.type) {
            case 'null':
                return '???';
            case 'triple':
                if (this.nick === this.first) {
                    return `'${this.first}' ${this.last}`;
                } else if (this.nick === this.last) {
                    return `${this.first} '${this.last}'`;
                } else {
                    return `${this.first} '${this.nick}' ${this.last}`;
                }
            case 'single':
                return `'${this.nick}'`;
        }
    }

    toString(): string {
        return this.fullName;
    }
}

export class Faction {
    readonly name: string;
    readonly id: number;
    readonly def: string;
    readonly leaderID: string | null;
    readonly relations: {
        [other: string]: {
            kind: 'Hostile' | 'Neutral' | 'Ally'
            goodwill: number
        }
    };

    get strID() {
        return 'Faction_' + this.id;
    }

    get leader(): Faction | null {
        return (this.leaderID) ? this.game.factions[this.leaderID] : null;
    }

    constructor(readonly game: Game, data: Element) {
        this.name = data.querySelector(':scope>name')?.textContent || 'Unnamed Faction';
        this.id = Number(data.querySelector(':scope>loadID')?.textContent || '0');
        this.def = findText(data, 'def');

        const leader = findText(data, 'leader');
        if (leader === 'null') {
            this.leaderID = null;
        } else {
            this.leaderID = leader.substr(6);
        }

        this.relations = {};
        Array.from(data.querySelectorAll(':scope>relations>li')).forEach((r) => {
            const kind = (r.querySelector(':scope>kind')?.textContent || 'Neutral') as 'Hostile' | 'Neutral' | 'Ally';
            this.relations[findText(r, 'other')] = {
                goodwill: Number(r.querySelector(':scope>goodwill')?.textContent || '0'),
                kind: (['Hostile', 'Neutral', 'Ally'].includes(kind)) ? kind : 'Neutral'
            };
        });
    }

    getRelationWith(other: string | Faction): { kind: string, goodwill: number } {
        if (other instanceof Faction) {
            other = other.strID;
        }
        const rel = this.relations[other];
        if (!rel) {
            throw new Error('No reltions to given faction');
        }
        return {
            kind: rel.kind,
            goodwill: rel.goodwill
        };
    }

    getPawns(): Pawn[] {
        return Object.values(this.game.pawns).filter((p) => p.faction === this);
    }
}

export class Game {
    readonly factions: { [id: string]: Faction };
    readonly pawns: { [id: string]: Pawn };
    readonly playerFaction: Faction;

    constructor(data: Element) {

        this.factions = {};
        Array.from(data.querySelectorAll(':scope>world>factionManager>allFactions>li'))
            .map((n) => new Faction(this, n))
            .forEach((f) => this.factions[f.strID] = f);

        this.playerFaction = Object.values(this.factions).find((f) => f.def === 'PlayerColony')!!;
        if (!this.playerFaction) {
            throw new Error('Couldn\'t find player faction');
        }

        this.pawns = {};

        const pawnIter = data.ownerDocument!!.evaluate('.//*[def="Human"]', data,
            null, XPathResult.ANY_TYPE);
        let def = pawnIter.iterateNext();
        while (def) {
            const pawn = new Pawn(this, def as Element);
            this.pawns[pawn.id] = pawn;
            def = pawnIter.iterateNext();
        }
    }
}
