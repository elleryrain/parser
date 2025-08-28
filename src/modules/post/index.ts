import { Browser, Page } from "puppeteer";
import fs from "node:fs";
import path from "node:path";
import { linksJsonPath, postsDir } from "../../config/consts";
import { delay } from "../../utils/delay";

interface PostLink {
  postId: string;
  url: string;
  parsed: boolean;
}

interface Comment {
  commentId: string;
  author: string;
  authorId: string;
  authorUrl: string;
  avatar: string;
  text: string;
  date: string;
  likes: number;
  isAuthor: boolean;
  replies: Comment[];
  error?: string;
}

interface PostContent {
  postId: string;
  description: string;
  images: string[];
  videos: string[];
}

export class PostParser {
  static async autoScroll(page: Page, maxAttempts: number = 10): Promise<void> {
    let attempts = 0;
    let previousHeight = await page.evaluate("document.body.scrollHeight");

    while (attempts < maxAttempts) {
      await page.evaluate("window.scrollTo(0, document.body.scrollHeight)");
      await delay(2000);

      const currentHeight = await page.evaluate("document.body.scrollHeight");
      if (currentHeight === previousHeight) {
        console.log(
          `Прокрутка завершена после ${
            attempts + 1
          } попыток: новая высота не появилась`
        );
        break;
      }

      previousHeight = currentHeight;
      attempts++;
      console.log(`Прокрутка ${attempts}/${maxAttempts}`);
    }

    if (attempts >= maxAttempts) {
      console.log(
        `Достигнуто максимальное количество попыток прокрутки (${maxAttempts})`
      );
    }
  }

  static async parsePosts(
    browser: Browser,
    page: Page,
    maxPosts: number = 200
  ) {
    try {
      // Чтение JSON-файла с ссылками
      const links: PostLink[] = JSON.parse(
        fs.readFileSync(linksJsonPath, { encoding: "utf-8" })
      );
      const unparsedLinks = links
        .filter((link) => !link.parsed)
        .slice(0, maxPosts);

      if (unparsedLinks.length === 0) {
        console.log("Нет непаршенных ссылок для обработки");
        await browser.close();
        return;
      }

      console.log(`Найдено ${unparsedLinks.length} непаршенных ссылок`);

      for (const link of unparsedLinks) {
        try {
          console.log(`Парсинг поста ${link.postId}: ${link.url}`);
          await page.goto(link.url);

          await this.autoScroll(page, 5);

          await page.evaluate(() => {
            document.querySelectorAll(".wall_reply_text").forEach((el) => {
              el.removeAttribute("onclick");
            });
          });

          const postContent: PostContent = await page.evaluate((postId) => {
            window.extractTextWithBreaks = function (node) {
              let text = "";
              for (const child of node.childNodes) {
                if (child.nodeType === Node.TEXT_NODE) {
                  const nodeText = child.textContent.trim();
                  if (nodeText) {
                    text += nodeText;
                  }
                } else if (child.nodeType === Node.ELEMENT_NODE) {
                  const tagName = child.tagName.toLowerCase();
                  if (
                    tagName === "br" ||
                    tagName === "div" ||
                    tagName === "p"
                  ) {
                    text += "\n";
                  }
                  text += extractTextWithBreaks(child);
                }
              }
              return text;
            };

            const descriptionElement = document.querySelector(
              ".wall_post_text_wrapper"
            );
            const description = descriptionElement
              ? extractTextWithBreaks(descriptionElement)
                  .trim()
                  .replace(/\n+/g, "\n")
              : "";

            console.log(description);
            const imageElements = document.querySelectorAll(
              ".vkitPrimaryAttachment__root--C8cW1 img"
            );
            const images = Array.from(imageElements)
              .map((img) => img.getAttribute("src") || "")
              .filter(Boolean);

            const videoElements = document.querySelectorAll(
              "video, a[href*='/video']"
            );
            const videos = Array.from(videoElements)
              .map((el) => {
                if (el.tagName.toLowerCase() === "video") {
                  return el.getAttribute("src") || "";
                } else {
                  return el.getAttribute("href") || "";
                }
              })
              .filter(Boolean);

            return { postId, description, images, videos };
          }, link.postId);

          const comments: any = await page.evaluate(() => {
            window.parseComment = function (element) {
              try {
                const commentId = element.getAttribute("data-post-id") || "";
                console.log(`Парсинг комментария ${commentId}`); // Логирование для отладки

                const authorElement = element.querySelector(
                  ".reply_author .author"
                );
                const author = authorElement
                  ? authorElement.textContent.trim()
                  : "";
                const authorId = authorElement
                  ? authorElement.getAttribute("data-from-id") || ""
                  : "";
                const authorUrl = authorElement
                  ? authorElement.getAttribute("href") || ""
                  : "";

                const avatarElement = element.querySelector(".AvatarRich__img");
                const avatar = avatarElement
                  ? avatarElement.getAttribute("src") || ""
                  : "";

                const textElement = element.querySelector(".wall_reply_text");
                const text = textElement ? textElement.textContent.trim() : "";

                const dateElement = element.querySelector(".rel_date");
                const date = dateElement ? dateElement.textContent.trim() : "";

                const likesElement =
                  element.querySelector(".like_button_count");
                const likes = likesElement
                  ? parseInt(likesElement.textContent || "0", 10)
                  : 0;

                const isAuthorElement = element.querySelector(
                  ".reply_author_label"
                );
                const isAuthor = isAuthorElement
                  ? isAuthorElement.textContent.includes("Автор")
                  : false;

                const repliesWrap =
                  element.nextElementSibling &&
                  element.nextElementSibling.classList.contains(
                    "replies_wrap_deep"
                  )
                    ? element.nextElementSibling.querySelectorAll(".reply")
                    : [];
                const replies = Array.from(repliesWrap).map((reply) => {
                  try {
                    return parseComment(reply);
                  } catch (err) {
                    console.error(
                      `Ошибка при парсинге вложенного комментария ${reply.getAttribute(
                        "data-post-id"
                      )}: ${err.message}`
                    );
                    return {
                      commentId: reply.getAttribute("data-post-id") || "",
                      author: "",
                      authorId: "",
                      authorUrl: "",
                      avatar: "",
                      text: "",
                      date: "",
                      likes: 0,
                      isAuthor: false,
                      replies: [],
                      error: err.message,
                    };
                  }
                });

                return {
                  commentId,
                  author,
                  authorId,
                  authorUrl,
                  avatar,
                  text,
                  date,
                  likes,
                  isAuthor,
                  replies,
                };
              } catch (err) {
                console.error(
                  `Ошибка при парсинге комментария ${element.getAttribute(
                    "data-post-id"
                  )}: ${err.message}`
                );
                console.log(`HTML комментария: ${element.outerHTML}`); // Логирование HTML для отладки
                return {
                  commentId: element.getAttribute("data-post-id") || "",
                  author: "",
                  authorId: "",
                  authorUrl: "",
                  avatar: "",
                  text: "",
                  date: "",
                  likes: 0,
                  isAuthor: false,
                  replies: [],
                  error: err.message,
                };
              }
            };

            const commentElements = document.querySelectorAll(
              ".replies_list > .reply"
            );
            console.log(commentElements);
            return Array.from(commentElements).map((element) =>
              parseComment(element)
            );
          });
          // console.log(comments);
          console.log(postContent);
          const postDir = path.join(postsDir, link.postId);

          fs.mkdirSync(postDir, { recursive: true });
          fs.writeFileSync(
            path.join(postDir, "description.txt"),
            postContent.description
          );

          const postContentJson: Omit<PostContent, "description"> = {
            postId: postContent.postId,
            images: postContent.images,
            videos: postContent.videos,
          };

          fs.writeFileSync(
            path.join(postDir, "post_content.json"),
            JSON.stringify(postContentJson, null, 2)
          );
          console.log(
            `Сохранен контент поста ${link.postId}: ${postContent.images.length} картинок, ${postContent.videos.length} видео`
          );

          fs.mkdirSync(postDir, { recursive: true });
          fs.writeFileSync(
            path.join(postDir, "comments.json"),
            JSON.stringify(comments, null, 2)
          );
          console.log(
            `Сохранены комментарии для поста ${link.postId}: ${comments.length} комментариев`
          );

          link.parsed = true;
          fs.writeFileSync(linksJsonPath, JSON.stringify(links, null, 2));
          console.log(`Пост ${link.postId} помечен как обработанный`);
        } catch (err) {
          console.error(`Ошибка при парсинге поста ${link.postId}:`, err);
        }
        await delay(1000);
      }

      await browser.close();
    } catch (err) {
      console.error("Ошибка при чтении links.json или парсинге:", err);
      await browser.close();
    }
  }
}
