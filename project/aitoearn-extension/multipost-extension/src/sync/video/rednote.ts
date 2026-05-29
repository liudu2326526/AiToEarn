import type { SyncData, VideoData } from "../common";

type PublishResultPayload = {
  success: boolean;
  workLink?: string;
  workId?: string;
  pendingConfirmation?: boolean;
  error?: string;
};

export async function VideoRednote(data: SyncData) {
  const { content, video, title, tags, cover, scheduledPublishTime } = data.data as VideoData;
  const publishTraceId = data.publishTraceId || "";

  async function reportPublishResult(result: PublishResultPayload) {
    if (!publishTraceId || typeof chrome === "undefined" || !chrome.runtime?.sendMessage) return;

    await chrome.runtime.sendMessage({
      action: "MULTIPOST_EXTENSION_PUBLISH_RESULT",
      data: {
        type: "MULTIPOST_EXTENSION_PUBLISH_RESULT",
        traceId: publishTraceId,
        platform: "VIDEO_REDNOTE",
        ...result,
      },
    });
  }

  // 辅助函数：等待元素出现
  function waitForElement(selector: string, timeout = 10000): Promise<Element> {
    return new Promise((resolve, reject) => {
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
        return;
      }

      const observer = new MutationObserver(() => {
        const element = document.querySelector(selector);
        if (element) {
          resolve(element);
          observer.disconnect();
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });

      setTimeout(() => {
        observer.disconnect();
        reject(new Error(`Element with selector "${selector}" not found within ${timeout}ms`));
      }, timeout);
    });
  }

  function setNativeValue(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
    const prototype = Object.getPrototypeOf(element);
    const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
    descriptor?.set?.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }

  async function waitForPostClickSignal(timeout = 30000): Promise<PublishResultPayload> {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeout) {
      const href = window.location.href;
      const bodyText = document.body?.textContent || "";

      if (bodyText.includes("发布成功") || bodyText.includes("提交成功") || bodyText.includes("作品已发布")) {
        const workLink = await waitForPublishedWorkLink();
        return {
          success: true,
          ...(workLink ? { workLink } : { pendingConfirmation: true }),
        };
      }

      if (href.includes("/note-manager")) {
        const workLink = await waitForPublishedWorkLink();
        return {
          success: true,
          ...(workLink ? { workLink } : { pendingConfirmation: true }),
        };
      }

      const explicitError = ["发布失败", "上传失败", "请先上传", "内容不能为空", "标题不能为空"].find((text) =>
        bodyText.includes(text),
      );
      if (explicitError) {
        throw new Error(`XHS video publish failed: ${explicitError}`);
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    return {
      success: true,
      pendingConfirmation: true,
    };
  }

  function findPublishedWorkLink() {
    const anchors = Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]"));
    return anchors
      .map((anchor) => {
        try {
          return new URL(anchor.href, window.location.origin).toString();
        } catch {
          return "";
        }
      })
      .find((url) =>
        /xiaohongshu\.com\/(?:explore|discovery\/item)\//.test(url)
        || /xiaohongshu\.com\/user\/profile\/[^/]+\/[^/?#]+/.test(url),
      );
  }

  async function waitForPublishedWorkLink(timeout = 15000) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeout) {
      const link = findPublishedWorkLink();
      if (link) return link;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    return undefined;
  }

  function getNormalizedText(element: Element) {
    return (element.textContent || "").replace(/\s+/g, "").trim();
  }

  function isVisibleElement(element: HTMLElement) {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
  }

  function isElementDisabled(element: HTMLElement) {
    return (
      element.getAttribute("aria-disabled") === "true"
      || element.getAttribute("disabled") !== null
      || (element instanceof HTMLButtonElement && element.disabled)
      || element.className.toString().toLowerCase().includes("disabled")
    );
  }

  function findPublishButton() {
    const host = document.querySelector("xhs-publish-btn") as HTMLElement | null;
    if (host?.shadowRoot) {
      const inShadow = Array.from(host.shadowRoot.querySelectorAll<HTMLElement>("button"))
        .filter(isVisibleElement)
        .filter((el) => {
          const text = getNormalizedText(el);
          const cls = el.className?.toString().toLowerCase() || "";
          return text.includes("发布") || cls.includes("red") || cls.includes("primary");
        });
      if (inShadow.length > 0) return inShadow[inShadow.length - 1];
    }
    if (host && isVisibleElement(host)) return host;

    const narrowSelectors = [
      "button",
      "[role='button']",
      "div[class*='btn']",
      "div[class*='button']",
      "div[class*='publish']",
      "div[class*='submit']",
      "span[class*='btn']",
      "span[class*='button']",
    ].join(",");
    let candidates = Array.from(document.querySelectorAll<HTMLElement>(narrowSelectors))
      .filter(isVisibleElement)
      .filter((element) => {
        const text = getNormalizedText(element);
        return text === "发布" || (text.includes("发布") && !["发布笔记", "定时发布", "发布列表"].includes(text));
      });

    if (candidates.length === 0) {
      candidates = Array.from(document.querySelectorAll<HTMLElement>("*"))
        .filter(isVisibleElement)
        .filter((element) => {
          const text = getNormalizedText(element);
          if (text !== "发布") return false;
          const rect = element.getBoundingClientRect();
          return rect.width < 500 && rect.height < 200;
        });
    }

    if (candidates.length === 0) return undefined;

    return candidates.sort((a, b) => b.getBoundingClientRect().bottom - a.getBoundingClientRect().bottom)[0];
  }

  function getClickableTarget(element: HTMLElement): HTMLElement {
    let node: HTMLElement | null = element;
    for (let i = 0; i < 4 && node; i++) {
      const tag = node.tagName.toLowerCase();
      const role = node.getAttribute("role");
      const cls = node.className?.toString().toLowerCase() || "";
      if (tag === "button" || role === "button" || cls.includes("btn") || cls.includes("button") || cls.includes("publish") || cls.includes("submit")) {
        return node;
      }
      node = node.parentElement;
    }
    return element;
  }

  function clickElement(element: HTMLElement) {
    const target = getClickableTarget(element);
    target.scrollIntoView({ block: "center", inline: "center" });
    target.focus?.();
    const opts = { bubbles: true, cancelable: true, view: window };
    target.dispatchEvent(new PointerEvent("pointerdown", opts));
    target.dispatchEvent(new MouseEvent("mousedown", opts));
    target.dispatchEvent(new PointerEvent("pointerup", opts));
    target.dispatchEvent(new MouseEvent("mouseup", opts));
    target.dispatchEvent(new MouseEvent("click", opts));
    target.click?.();
  }

  // 辅助函数：上传文件
  async function uploadVideo() {
    const fileInput = (await waitForElement('input[type="file"]')) as HTMLInputElement;
    if (!fileInput) {
      throw new Error("XHS video publish failed: video file input not found");
    }

    const dataTransfer = new DataTransfer();

    if (video) {
      try {
        const response = await fetch(video.url);
        if (!response.ok) {
          throw new Error(`HTTP error: ${response.status}`);
        }
        const blob = await response.blob();
        const file = new File([blob], video.name, { type: video.type });
        dataTransfer.items.add(file);
      } catch (error) {
        console.error(`上传视频 ${video.url} 失败:`, error);
      }
    }

    if (dataTransfer.files.length === 0) {
      throw new Error("XHS video publish failed: no video file added to upload input");
    }

    fileInput.files = dataTransfer.files;
    fileInput.dispatchEvent(new Event("change", { bubbles: true }));
    fileInput.dispatchEvent(new Event("input", { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 2000));
    console.log("文件上传操作完成");
  }

  /**
   * 设置定时发布时间
   * @param scheduledPublishTime - 定时发布时间戳（毫秒）
   */
  async function setScheduledPublishTime(scheduledPublishTime: number): Promise<void> {
    const labels = document.querySelectorAll("label");
    console.debug("labels -->", labels);

    const scheduledLabel = Array.from(labels).find((label) => label.textContent?.includes("定时发布"));
    console.debug("label -->", scheduledLabel);

    if (scheduledLabel) {
      (scheduledLabel as HTMLElement).click();
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    const publishTimeInput = document.querySelector('input[placeholder="选择日期和时间"]') as HTMLInputElement;
    console.debug("publishTimeInput -->", publishTimeInput);

    if (publishTimeInput) {
      // 计算时间：添加 8 小时（28800000 毫秒）以调整时区
      const adjustedTime = new Date(scheduledPublishTime + 28800000);
      const formattedTime = adjustedTime.toISOString().slice(0, 16).replace("T", " ");

      publishTimeInput.focus();
      await new Promise((resolve) => setTimeout(resolve, 100));

      setNativeValue(publishTimeInput, formattedTime);
      publishTimeInput.blur();

      console.debug("定时发布时间已设置:", formattedTime);
    }
  }

  // 辅助函数：上传封面
  async function uploadCover(coverFile: NonNullable<VideoData["cover"]>) {
    console.debug("tryCover", coverFile);
    const coverUploadTrigger = document.querySelector("div.noCover.uploadCover") as HTMLElement;
    console.debug("coverUpload", coverUploadTrigger);
    if (!coverUploadTrigger) {
      console.error("未找到封面上传触发器: div.noCover.uploadCover");
      return;
    }
    coverUploadTrigger.click();

    const fileInputSelector = "input[accept='image/png, image/jpeg, image/*']";
    try {
      await waitForElement(fileInputSelector);
    } catch (e) {
      console.error(`等待元素 ${fileInputSelector} 超时`, e);
      return;
    }

    const fileInput = document.querySelector(fileInputSelector) as HTMLInputElement;
    console.debug("fileInput", fileInput);
    if (!fileInput) {
      console.error("未找到封面上传的文件输入元素");
      return;
    }

    const dataTransfer = new DataTransfer();
    console.debug("try upload file", coverFile);
    if (!coverFile.type.includes("image/")) {
      console.error("提供的封面文件不是图片");
      return;
    }

    try {
      const response = await fetch(coverFile.url);
      const arrayBuffer = await response.arrayBuffer();
      const file = new File([arrayBuffer], coverFile.name, { type: coverFile.type });
      dataTransfer.items.add(file);
    } catch (error) {
      console.error(`上传封面 ${coverFile.url} 失败:`, error);
      return;
    }

    if (dataTransfer.files.length === 0) {
      return;
    }

    fileInput.files = dataTransfer.files;
    fileInput.dispatchEvent(new Event("change", { bubbles: true }));
    fileInput.dispatchEvent(new Event("input", { bubbles: true }));
    console.debug("文件上传操作触发");
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const doneButtons = document.querySelectorAll("span");
    console.debug("doneButtons", doneButtons);
    const doneButton = Array.from(doneButtons).find((btn) => btn.textContent?.trim() === "确定");
    console.debug("doneButton", doneButton);
    if (doneButton) {
      (doneButton as HTMLElement).click();
    }
  }

  async function clickPublishButton() {
    const publishButton = findPublishButton();

    if (!publishButton) {
      throw new Error("XHS video publish failed: publish button not found");
    }

    const startedAt = Date.now();
    let lastLogAt = 0;
    const maxWait = 300000;
    while (isElementDisabled(publishButton)) {
      if (Date.now() - startedAt > maxWait) {
        throw new Error("XHS video publish failed: publish button stayed disabled (upload timeout)");
      }
      if (Date.now() - lastLogAt > 30000) {
        console.debug(`waiting for video upload... ${Math.round((Date.now() - startedAt) / 1000)}s elapsed`);
        lastLogAt = Date.now();
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    clickElement(publishButton);
  }

  try {
    // 等待页面加载
    await waitForElement('span[class="title"]');
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 上传视频
    await uploadVideo();

    // 填写内容
    // 等待标题输入框出现
    await waitForElement('input[type="text"]');
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 填写标题
    const titleInput = document.querySelector('input[type="text"]') as HTMLInputElement;
    if (titleInput) {
      const finalTitle = title?.slice(0, 20) || content?.slice(0, 20) || "";
      setNativeValue(titleInput, finalTitle);
    }

    // 填写内容和标签
    const editor = document.querySelector('div[contenteditable="true"]') as HTMLElement;
    if (!editor) {
      throw new Error("XHS video publish failed: content editor not found");
    }

    // 填写正文内容
    editor.focus();
    const contentPasteEvent = new ClipboardEvent("paste", {
      bubbles: true,
      cancelable: true,
      clipboardData: new DataTransfer(),
    });
    contentPasteEvent.clipboardData?.setData("text/plain", `${content}\n` || "");
    editor.dispatchEvent(contentPasteEvent);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    editor.blur();

    // 添加标签
    if (tags && tags.length > 0) {
      for (const tag of tags) {
        const cleanTag = tag.replace(/^#+|#+$/g, "");
        if (!cleanTag) continue;

        editor.focus();
        const tagPasteEvent = new ClipboardEvent("paste", {
          bubbles: true,
          cancelable: true,
          clipboardData: new DataTransfer(),
        });
        tagPasteEvent.clipboardData?.setData("text/plain", `#${cleanTag}`);
        editor.dispatchEvent(tagPasteEvent);
        await new Promise((resolve) => setTimeout(resolve, 1500));

        // 模拟回车键按下以确认标签
        const enterEvent = new KeyboardEvent("keydown", {
          bubbles: true,
          cancelable: true,
          key: "Enter",
          code: "Enter",
          keyCode: 13,
          which: 13,
        });
        editor.dispatchEvent(enterEvent);
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    // 上传封面
    if (cover) {
      await uploadCover(cover);
    }

    // 处理定时发布
    if (scheduledPublishTime) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await setScheduledPublishTime(scheduledPublishTime);
    }

    if (!data.isAutoPublish) {
      await reportPublishResult({ success: true, pendingConfirmation: true });
      return;
    }

    // 先报告"已提交"再点击——因为点击后 XHS 会立即跳转，脚本上下文被销毁
    await reportPublishResult({ success: true, pendingConfirmation: true });
    try {
      if (publishTraceId && typeof chrome !== "undefined" && chrome.storage?.local) {
        await chrome.storage.local.set({
          xhs_pending_backfill: { traceId: publishTraceId, platform: "VIDEO_REDNOTE", ts: Date.now() },
        });
      }
    } catch (e) {
      console.warn("存储待回扫标记失败", e);
    }
    await clickPublishButton();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await reportPublishResult({
      success: false,
      error: message,
    });
    throw error;
  }
}
