import {
  readdirSync,
  lstatSync,
  readFileSync,
  writeFileSync,
  existsSync,
} from "fs";
import { join } from "path";
import { execSync } from "child_process";

// Function to update the @huggingface/transformers version
const updateDependency = (projectPath, version) => {
  const packageJsonPath = join(projectPath, "package.json");

  try {
    // Read and parse package.json
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));

    // Update @huggingface/transformers to the latest version
    if (
      packageJson.dependencies &&
      packageJson.dependencies["@huggingface/transformers"] !== version
    ) {
      console.log(`Updating @huggingface/transformers in ${projectPath}`);
      packageJson.dependencies["@huggingface/transformers"] = version;
      writeFileSync(
        packageJsonPath,
        JSON.stringify(packageJson, null, 2) + "\n",
      );
    }

    // Detect lock file and run appropriate command
    if (existsSync(join(projectPath, "package-lock.json"))) {
      console.log(`Running npm install in ${projectPath}`);
      execSync("npm install", { cwd: projectPath, stdio: "inherit" });
    } else if (existsSync(join(projectPath, "bun.lockb"))) {
      console.log(`Running bun install in ${projectPath}`);
      execSync("bun install", { cwd: projectPath, stdio: "inherit" });
    } else {
      console.log(`No lock file detected in ${projectPath}`);
    }
  } catch (error) {
    console.error(`Failed to update ${projectPath}:`, error.message);
  }
};

// Get the latest version of @huggingface/transformers
let version = "latest";
try {
  version = execSync("npm view @huggingface/transformers version", {
    encoding: "utf-8",
  }).trim();
  console.log(`Version: ${version}`);
} catch (error) {
  console.error(`Error: ${error.message}`);
}

// Iterate over all directories in the monorepo
readdirSync(".").forEach((project) => {
  if (
    lstatSync(project).isDirectory() &&
    existsSync(join(project, "package.json"))
  ) {
    updateDependency(project, version);
  }
});

console.log("All projects updated!");
