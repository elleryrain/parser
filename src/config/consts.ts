import * as path from "node:path";

export const authUrl = `https://vk.com/login`;
export const cookiesPath = path.join(process.cwd(), "cookies.json");
export const postsDir = path.join(process.cwd(), "posts");
