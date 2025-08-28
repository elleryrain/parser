import * as path from "node:path";

export const authUrl = `https://vk.com/login`;
export const cookiesPath = path.join(process.cwd(), "cookies.json");
export const postsDir = path.join(process.cwd(), "posts");
export const linksJsonPath = path.join(process.cwd(), "posts", "posts.json");
export enum ETypeArgsParser {
  getPosts = "get-posts",
  parsePosts = "parse-posts",
}
