'use strict';

class DiagnosticManager {
  constructor(vscode) {
    if (!vscode?.languages?.createDiagnosticCollection) {
      throw new TypeError('A valid VS Code API is required.');
    }

    this.vscode = vscode;
    this.collection =
      vscode.languages.createDiagnosticCollection('fo-spell');
  }

  publish(uri, findings, options = {}) {
    const showReviewWarnings =
      options.showReviewWarnings === true;

    const diagnostics = [];

    for (const finding of findings) {
      if (!finding?.range) continue;

      let severity;
      let message;
      let code;

      if (finding.status === 'error') {
        severity = this.vscode.DiagnosticSeverity.Error;
        message = 'Faroese spelling error';
        code = 'faroese-spelling';
      } else if (
        finding.status === 'review' &&
        showReviewWarnings
      ) {
        severity = this.vscode.DiagnosticSeverity.Information;
        message = 'Linguistic review suggested';
        code = 'linguistic-review';
      } else {
        continue;
      }

      const diagnostic = new this.vscode.Diagnostic(
        finding.range,
        message,
        severity
      );

      diagnostic.source = 'Fo-Spell';
      diagnostic.code = code;

      const suggestions = Array.isArray(finding.suggestions)
        ? finding.suggestions
            .filter(value => typeof value === 'string')
            .slice(0, 6)
        : [];

      if (suggestions.length) {
        diagnostic.message +=
          ' — suggestions: ' + suggestions.join(', ');
      }

      diagnostics.push(diagnostic);
    }

    this.collection.set(uri, diagnostics);

    return diagnostics;
  }

  clear(uri) {
    this.collection.delete(uri);
  }

  clearAll() {
    this.collection.clear();
  }

  dispose() {
    this.collection.dispose();
  }
}

module.exports = { DiagnosticManager };
