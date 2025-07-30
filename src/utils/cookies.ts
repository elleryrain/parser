import { Browser } from "puppeteer";
import fsp from "node:fs/promises";

export async function saveCookies(browser: Browser, filePath: string) {
  try {
    const cookies = await browser.cookies();
    await fsp.writeFile(filePath, JSON.stringify(cookies, null, 2));
    console.log("Куки успешно сохранены в", filePath);
    return cookies;
  } catch (err) {
    console.error("Ошибка при сохранении куки:", err.message);
    return null;
  }
}
