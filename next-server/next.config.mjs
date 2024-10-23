/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  // https://nextjs.org/docs/app/api-reference/next-config-js/serverExternalPackages
  serverExternalPackages: ["@huggingface/transformers"],
};

export default nextConfig;
