import { readdirSync, lstatSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";

// Function to run build command if a 'build' script is present in package.json
const buildProject = (projectPath) => {
  const packageJsonPath = join(projectPath, "package.json");

  if (existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));

    if (packageJson?.scripts?.build) {
      try {
        console.log(
          `'build' script detected in ${projectPath}. Running npm run build...`,
        );
        execSync("npm run build", { cwd: projectPath, stdio: "inherit" });
      } catch (error) {
        console.error(`Failed to build ${projectPath}:`, error.message);
      }
    } else {
      console.log(`No 'build' script found in ${projectPath}`);
    }
  }
};

// Iterate over all directories in the monorepo
readdirSync(".").forEach((project) => {
  if (
    lstatSync(project).isDirectory() &&
    existsSync(join(project, "package.json"))
  ) {
    buildProject(project);
  }
});

console.log("Build process completed for all applicable projects!");
