import { Browser, Page } from "puppeteer";
import { authUrl, cookiesPath } from "../config/consts";
import { delay } from "./delay";
import { saveCookies } from "./cookies";

export async function performAuthorization(page: Page, browser: Browser) {
  try {
    console.log("Переходим на страницу авторизации:", authUrl);
    await page.goto(authUrl, { waitUntil: "networkidle2" });

    console.log("Ожидаем завершения авторизации...");
    await page.waitForNavigation({
      waitUntil: "networkidle2",
      timeout: 24000,
    });

    await delay(15000);

    const currentUrl = page.url();
    console.log("Текущий URL:", currentUrl);

    if (currentUrl.includes("vk.com/feed") || currentUrl.includes("vk.com")) {
      console.log("Авторизация успешна!");
      await saveCookies(browser, cookiesPath);
      return true;
    } else {
      console.error("Ошибка: авторизация не удалась. Текущий URL:", currentUrl);
      return false;
    }
  } catch (err) {
    console.error("Ошибка при авторизации:", err.message);
    return false;
  }
}
