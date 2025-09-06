const fs = require("fs");
const jszip = require("jszip");
const crypto = require("crypto");
const path = require("path");

const date = new Date().toISOString();

const generateBuildFile = (platform, arch, maker) => {
  const package = fs.readFileSync(path.join(__dirname, "package.json"), "utf8");
  const hash = crypto.createHash("sha256").update(package);
  const data = {
    id: hash.digest("hex").slice(-6),
    platform: platform,
    arch: arch,
    maker: maker,
    date: date,
  };
  return JSON.stringify(data, null, 2);
};

module.exports = {
  packagerConfig: {
    ignore: [".github", ".gitignore", "install.sh", "forge.config.js"],
  },
  makers: [
    {
      name: "@electron-forge/maker-deb",
      config: {
        options: {
          productName: "TouchKio",
          productDescription: "Kiosk mode application for a Home Assistant dashboard",
          categories: ["Network"],
          icon: "img/icon.png",
        },
      },
    },
    {
      name: "@electron-forge/maker-zip",
    },
  ],
  publishers: [
    {
      name: "@electron-forge/publisher-github",
      config: {
        repository: {
          owner: "leukipp",
          name: "touchkio",
        },
        draft: true,
      },
    },
  ],
  hooks: {
    postPackage: async (config, results) => {
      for (const outputPath of results.outputPaths) {
        const [name, platform, arch] = path.basename(outputPath).split("-");
        const buildFile = path.join(outputPath, "resources", "app", "build.json");
        fs.writeFileSync(buildFile, generateBuildFile(platform, arch, "deb"), { encoding: "utf8" });
      }
    },
    postMake: async (config, results) => {
      for (const result of results) {
        const artifacts = [];
        for (const artifact of result.artifacts) {
          // Currently disabled for zip files as it seems to corrupt them
          if (artifact.includes(".zip") && false) {
            const [name, platform, arch] = path.basename(artifact).split("-");
            const buildFile = path.join(`${name}-${platform}-${arch}`, "resources", "app", "build.json");
            const zip = await jszip.loadAsync(fs.readFileSync(artifact, "utf8"));
            zip.file(buildFile, generateBuildFile(platform, arch, "zip"));
            fs.writeFileSync(artifact, await zip.generateAsync({ type: "nodebuffer" }));
          }
          if (artifact.includes("amd64")) {
            const renamed = artifact.replace("amd64", "x64");
            fs.renameSync(artifact, renamed);
            artifacts.push(renamed);
          } else {
            artifacts.push(artifact);
          }
        }
        result.artifacts = artifacts;
      }
    },
  },
};
