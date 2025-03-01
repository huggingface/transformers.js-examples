const fs = require("fs")

const sed = () => {
  //   console.log("func:sed");
  //   console.log(
  //     Object.entries(process.env).filter(([key]) => key.startsWith("PLASMO_")),
  //   );
  const targetDir = `${process.env.PLASMO_BUILD_DIR}/${process.env.PLASMO_TARGET}-${process.env.PLASMO_TAG}`
  //   console.log(targetDir);

  // implement sed file
  const sedFile = `${targetDir}/static/background/index.js`
  const srcString = "new URL\\(import.meta.url\\)"
  const dstString = "new URL(self.location.href)"

  //   console.log(sedFile);
  try {
    // Read the file content
    const content = fs.readFileSync(sedFile, "utf8")

    // Replace all occurrences of srcString with dstString
    const updatedContent = content.replace(
      new RegExp(srcString, "g"),
      dstString
    )

    // Write the modified content back to the file
    fs.writeFileSync(sedFile, updatedContent, "utf8")

    // console.log(
    //   `Successfully replaced "${srcString}" with "${dstString}" in ${sedFile}`,
    // );
  } catch (error) {
    console.error(`Error processing file ${sedFile}:`, error)
  }
}

module.exports = sed
