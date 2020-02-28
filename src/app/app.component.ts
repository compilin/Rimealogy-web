import { Component, ViewChild, ElementRef } from '@angular/core';
import { faBars } from '@fortawesome/free-solid-svg-icons';
import { Pawn, Game } from './rimealogy.defs';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {

  @ViewChild('inputfile', { static: true }) readonly fileInput: ElementRef<HTMLInputElement>;
  readonly faBars = faBars;
  loading = false;

  game?: Game;
  document: Document;

  loadFile() {
    if ((this.fileInput.nativeElement.files || []).length > 0) {
      const inFile = this.fileInput.nativeElement.files!![0];
      console.log('Reading file', inFile);
      const reader = new FileReader();
      this.loading = true;
      reader.onload = this.parseFile.bind(this);
      reader.readAsText(inFile);
    }
  }

  parseFile(ev: ProgressEvent<FileReader>) {
    console.log('Parsing file');
    const parser = new DOMParser();
    const xml = parser.parseFromString(ev.target!!.result as string, 'text/xml');
    console.log('Parsed XML', xml);
    this.document = xml;
    const game = xml.querySelector(':root>game');
    if (!game) {
      throw Error('No <game> tag found');
    }
    this.game = new Game(game);
    this.loading = false;
  }

  findPawns(): string[] {
    const pawnDefs: Node[] = [];
    const pawnIter = this.document.evaluate('.//*[def="Human"]', this.document.querySelector(':root>game')!!,
      null, XPathResult.ANY_TYPE);
    let pawn = pawnIter.iterateNext();
    while (pawn) {
      pawnDefs.push(pawn);
      pawn = pawnIter.iterateNext();
    }

    const paths = pawnDefs.map((p) => {
      let path = p.nodeName;
      let parent = p.parentElement;
      while (parent) {
        path = parent.nodeName + '/' + path;
        parent = parent.parentElement;
      }
      return path;
    });

    return Array.from(new Set(paths));
  }
}
