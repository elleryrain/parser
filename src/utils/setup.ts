import fs from "node:fs";
import fsp from "node:fs/promises";
import { postsDir } from "../config/consts";

export async function setup() {
  try {
    await fsp.access(postsDir);
  } catch (err) {
    fs.mkdirSync(postsDir);
  }
}
