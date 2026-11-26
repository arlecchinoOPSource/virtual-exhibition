// Validates every exported model, and every third-party original, with the
// Khronos glTF Validator (docs/ASSET_PIPELINE.md, intake step 7).
//
//   npm run validate:models
//
// Any error fails. Warnings are printed for review: the known ones are
// MESH_PRIMITIVE_GENERATED_TANGENT_SPACE on the normal-mapped floor, walls
// and basement surfaces, whose tangents Three.js derives per pixel.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import validator from 'gltf-validator';

const exported = readdirSync('public/models')
  .filter((name) => name.endsWith('.glb'))
  .map((name) => join('public/models', name));
const originals = readdirSync('assets-source/third-party').flatMap((id) =>
  readdirSync(join('assets-source/third-party', id))
    .filter((name) => name.endsWith('.glb'))
    .map((name) => join('assets-source/third-party', id, name)),
);

let failed = false;
for (const path of [...exported, ...originals]) {
  const report = await validator.validateBytes(
    new Uint8Array(readFileSync(path)),
    { uri: path, maxIssues: 50 },
  );
  const { numErrors, numWarnings, numInfos, numHints } = report.issues;
  const bad = numErrors > 0;
  failed ||= bad;
  console.log(
    `${bad ? 'FAIL' : 'ok  '} ${path}: ${numErrors} errors, ${numWarnings} warnings, ${numInfos} infos, ${numHints} hints`,
  );
  for (const issue of report.issues.messages)
    if (issue.severity <= 1)
      console.log(
        `       ${issue.code} at ${issue.pointer ?? ''}: ${issue.message}`,
      );
}
process.exit(failed ? 1 : 0);
