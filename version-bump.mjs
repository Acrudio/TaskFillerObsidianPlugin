import { readFileSync, writeFileSync } from "fs";

const targetVersion = process.env.npm_package_version;

// Read minAppVersion from manifest.json and bump the plugin version to match package.json.
const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
const { minAppVersion } = manifest;
manifest.version = targetVersion;
writeFileSync("manifest.json", JSON.stringify(manifest, null, "\t") + "\n");

// Record the plugin version -> minimum Obsidian version mapping so older clients
// can still resolve a compatible release.
const versions = JSON.parse(readFileSync("versions.json", "utf8"));
versions[targetVersion] = minAppVersion;
writeFileSync("versions.json", JSON.stringify(versions, null, "\t") + "\n");
