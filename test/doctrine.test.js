import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DOCTRINE_FITS, filterFits, exportFit } from '../doctrine-data.js';

test('doctrine search matches hull, role and category and combines with category filters', () => {
  assert.equal(filterFits('  cRoW  ')[0].id, 'crow-jackrabbit');
  assert.equal(filterFits('shield', 'Logistics')[0].hull, 'Basilisk');
  assert.equal(filterFits('crow', 'Ratting').length, 0);
  assert.equal(filterFits('nonexistent').length, 0);
  assert.equal(filterFits().length, DOCTRINE_FITS.length);
});

test('EFT export uses EVE rack order and preserves duplicate fitted modules', () => {
  const sections = exportFit(DOCTRINE_FITS[0]).trimEnd().split('\n\n');
  assert.equal(sections[0], '[Crow, Crow Jackrabbit]\nOverdrive Injector System II\nOverdrive Injector System II');
  assert(sections[1].startsWith('Faint Epsilon Scoped Warp Scrambler\n'));
  assert.equal(sections[2], 'Interdiction Nullifier II');
  assert.equal(sections[3], 'Small Polycarbon Engine Housing I\nSmall Ionic Field Projector I');
});

test('EFT drone quantities export as a separate section', () => {
  const fit = DOCTRINE_FITS.find(fit => fit.hull === 'Gila');
  assert(exportFit(fit).endsWith('\n\nVespa II x2\n'));
});
