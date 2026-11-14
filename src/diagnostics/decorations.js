'use strict';

class Decorations {
  constructor(vscode) {
    if (!vscode?.window?.createTextEditorDecorationType) {
      throw new TypeError('A valid VS Code API is required.');
    }

    this.vscode = vscode;

    this.red = vscode.window.createTextEditorDecorationType({
      textDecoration: 'underline wavy #E05252',
      overviewRulerColor: '#E05252',
      overviewRulerLane: vscode.OverviewRulerLane.Right,
    });

    this.blue = vscode.window.createTextEditorDecorationType({
      textDecoration: 'underline wavy #5795D5',
      overviewRulerColor: '#5795D5',
      overviewRulerLane: vscode.OverviewRulerLane.Right,
    });
  }

  refresh(editors, findingsByUri, showReviewWarnings = false) {
    for (const editor of editors) {
      const uri = editor.document.uri.toString();
      const findings = findingsByUri.get(uri) || [];

      const redRanges = [];
      const blueRanges = [];

      for (const finding of findings) {
        if (!finding.range) continue;

        if (finding.status === 'error') {
          redRanges.push(finding.range);
        } else if (
          finding.status === 'review' &&
          showReviewWarnings
        ) {
          blueRanges.push(finding.range);
        }
      }

      editor.setDecorations(this.red, redRanges);
      editor.setDecorations(this.blue, blueRanges);
    }
  }

  clear(editors) {
    for (const editor of editors) {
      editor.setDecorations(this.red, []);
      editor.setDecorations(this.blue, []);
    }
  }

  dispose(editors = []) {
    this.clear(editors);
    this.red.dispose();
    this.blue.dispose();
  }
}

module.exports = { Decorations };
