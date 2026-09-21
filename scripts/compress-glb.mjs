/**
 * Compress F1 GLB with Draco for in-browser delivery.
 * Reduces ~2.8MB raw to ~500KB Draco-compressed.
 */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { draco, prune, dedup, weld } from '@gltf-transform/functions';
import { promises as fs } from 'fs';
import draco3d from 'draco3d';

const INPUT = '/Users/pedroroig/Desktop/Universidad/Cuarto/Q1/TFG/portfolio/public/models/f1-2022.glb';
const OUTPUT = '/Users/pedroroig/Desktop/Universidad/Cuarto/Q1/TFG/portfolio/public/models/f1-2022-draco.glb';

async function compress() {
  // Initialize Draco encoder/decoder modules (wasm)
  const encoder = await draco3d.createEncoderModule();
  const decoder = await draco3d.createDecoderModule();

  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({
      'draco3d.encoder': encoder,
      'draco3d.decoder': decoder,
    });

  console.log('Reading...');
  const doc = await io.read(INPUT);

  console.log('Optimizing (dedup, prune, weld, draco)...');
  await doc.transform(
    dedup(),
    prune(),
    weld(),
    draco({
      method: 'edgebreaker',
      encodeSpeed: 5,
      decodeSpeed: 5,
    })
  );

  console.log('Writing...');
  const glb = await io.writeBinary(doc);
  await fs.writeFile(OUTPUT, glb);

  const inSize = (await fs.stat(INPUT)).size;
  const outSize = (await fs.stat(OUTPUT)).size;
  console.log(`Input:  ${(inSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Output: ${(outSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Reduction: ${((1 - outSize / inSize) * 100).toFixed(1)}%`);
}

compress().catch((err) => {
  console.error(err);
  process.exit(1);
});
