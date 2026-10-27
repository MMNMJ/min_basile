#target illustrator
// Open the Min-Basile Bouchon SVG in Illustrator, then run File > Scripts > Other Script.
(function () {
  if (!app.documents.length) { alert('Open the exported SVG first.'); return; }
  var doc = app.activeDocument;
  var boards = [];
  for (var i = 0; i < doc.groupItems.length; i++) {
    var group = doc.groupItems[i];
    var match = /^(?:Board[_ ]0*|판\s*)(\d+)$/i.exec(group.name);
    if (match) boards.push({ group: group, number: parseInt(match[1], 10) });
  }
  if (!boards.length) { alert('No Board_01 / Board_02 groups found. Open the SVG with File > Open, not Place.'); return; }
  boards.sort(function (a, b) { return a.number - b.number; });
  for (var j = boards.length - 1; j >= 0; j--) {
    var layer = doc.layers.add();
    layer.name = '판 ' + boards[j].number;
    boards[j].group.move(layer, ElementPlacement.PLACEATBEGINNING);
  }
  alert(boards.length + ' board layers created. Save the document as an .ai file.');
})();
