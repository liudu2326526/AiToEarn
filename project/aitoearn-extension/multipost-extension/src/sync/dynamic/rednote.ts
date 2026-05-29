import type { DynamicData, SyncData } from "../common";

type PublishResultPayload = {
  success: boolean;
  workLink?: string;
  workId?: string;
  pendingConfirmation?: boolean;
  error?: string;
};

// 优先发布图文
export async function DynamicRednote(data: SyncData) {
  const { title, content, images, tags } = data.data as DynamicData;
  const publishTraceId = data.publishTraceId || "";

  async function reportPublishResult(result: PublishResultPayload) {
    if (!publishTraceId || typeof chrome === "undefined" || !chrome.runtime?.sendMessage) return;

    await chrome.runtime.sendMessage({
      action: "MULTIPOST_EXTENSION_PUBLISH_RESULT",
      data: {
        type: "MULTIPOST_EXTENSION_PUBLISH_RESULT",
        traceId: publishTraceId,
        platform: "DYNAMIC_REDNOTE",
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

  async function fillInputText(input: HTMLInputElement, value: string) {
    setNativeValue(input, value);
    await new Promise((resolve) => setTimeout(resolve, 200));
    if (input.value === value) return;

    input.focus();
    const pasteEvent = new ClipboardEvent("paste", {
      bubbles: true,
      cancelable: true,
      clipboardData: new DataTransfer(),
    });
    pasteEvent.clipboardData?.setData("text/plain", value);
    input.dispatchEvent(pasteEvent);
    await new Promise((resolve) => setTimeout(resolve, 200));
    input.blur();
  }

  async function waitForImageUploadReady(expectedCount: number, timeout = 30000) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeout) {
      const previewItems = document.querySelectorAll(
        ".upload-image-list img, .image-list img, .upload-image-list .image-item, .image-list .image-item, img[src^='blob:']",
      );
      const publishButton = findPublishButton();

      if (previewItems.length >= expectedCount) return;
      if (publishButton && !isElementDisabled(publishButton)) return;

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw new Error(`XHS image publish failed: image upload did not become ready, expected ${expectedCount}`);
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
    // 0. XHS 把发布按钮放在 <xhs-publish-btn> 的 shadow DOM 里(配合 shadow-open content script 强制 open)
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
    // host 本身可点击（自定义元素整体响应 click）
    if (host && isVisibleElement(host)) return host;

    // 1. 常见按钮 selector
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

    // 2. 兜底：全文档扫描任何文本恰好是"发布"的最小可见元素
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

  async function waitUntilButtonEnabled(button: HTMLElement, timeout = 30000) {
    const startedAt = Date.now();
    while (isElementDisabled(button)) {
      if (Date.now() - startedAt > timeout) {
        throw new Error("XHS image publish failed: publish button stayed disabled");
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  function getClickableTarget(element: HTMLElement): HTMLElement {
    // 若命中的是按钮内的文字节点(span/div),向上回溯到真正可点击的祖先
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
    // 完整 pointer + mouse 事件序列(XHS React 组件可能监听 pointer 事件)
    const opts = { bubbles: true, cancelable: true, view: window };
    target.dispatchEvent(new PointerEvent("pointerdown", opts));
    target.dispatchEvent(new MouseEvent("mousedown", opts));
    target.dispatchEvent(new PointerEvent("pointerup", opts));
    target.dispatchEvent(new MouseEvent("mouseup", opts));
    target.dispatchEvent(new MouseEvent("click", opts));
    // 原生 click 兜底(React 能可靠捕获)
    target.click?.();
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
        throw new Error(`XHS image publish failed: ${explicitError}`);
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

  // 辅助函数：上传文件
  async function uploadImages() {
    const fileInput = (await waitForElement('input[type="file"]')) as HTMLInputElement;
    if (!fileInput) {
      throw new Error("XHS image publish failed: file input not found");
    }

    const dataTransfer = new DataTransfer();

    for (const fileInfo of images) {
      try {
        const response = await fetch(fileInfo.url);
        if (!response.ok) {
          throw new Error(`HTTP error: ${response.status}`);
        }
        const blob = await response.blob();
        const file = new File([blob], fileInfo.name, { type: fileInfo.type });
        dataTransfer.items.add(file);
      } catch (error) {
        console.error(`上传图片 ${fileInfo.url} 失败:`, error);
      }
    }

    if (dataTransfer.files.length === 0) {
      throw new Error("XHS image publish failed: no images added to upload input");
    }

    fileInput.files = dataTransfer.files;
    fileInput.dispatchEvent(new Event("change", { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 2000));
    console.log("文件上传操作完成");
  }

  try {
    if (!images || images.length === 0) {
      throw new Error("XHS image publish failed: no images provided");
    }

    // 等待页面加载
    await waitForElement('span[class="title"]');
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 点击上传图文按钮
    const uploadButtons = document.querySelectorAll('span[class="title"]');
    const uploadButton = Array.from(uploadButtons).find((element) =>
      element.textContent?.includes("上传图文"),
    ) as HTMLElement | undefined;

    if (!uploadButton) {
      throw new Error("XHS image publish failed: upload image button not found");
    }

    uploadButton.click();
    uploadButton.dispatchEvent(new Event("click", { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 上传文件
    await uploadImages();
    await waitForImageUploadReady(images.length);

    // 填写标题
    const titleInput = (await waitForElement('input[type="text"]')) as HTMLInputElement;
    if (!titleInput) {
      throw new Error("XHS image publish failed: title input not found");
    }
    const titleText = title || content?.slice(0, 20) || "";
    await fillInputText(titleInput, titleText);

    // 填写内容
    const contentEditor = (await waitForElement('div[contenteditable="true"]')) as HTMLDivElement;
    if (!contentEditor) {
      throw new Error("XHS image publish failed: content editor not found");
    }

    // 先填正文（不含标签）
    contentEditor.focus();
    const contentPasteEvent = new ClipboardEvent("paste", {
      bubbles: true,
      cancelable: true,
      clipboardData: new DataTransfer(),
    });
    contentPasteEvent.clipboardData?.setData("text/plain", `${content || ""}\n`);
    contentEditor.dispatchEvent(contentPasteEvent);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    console.log("设置内容:", content);

    // 逐个添加标签，让 XHS 识别为可点击话题（单 # + 回车，而非 #tag# 纯文本）
    if (tags?.length) {
      for (const tag of tags) {
        const cleanTag = tag.replace(/^#+|#+$/g, "");
        if (!cleanTag) continue;

        contentEditor.focus();
        const tagPasteEvent = new ClipboardEvent("paste", {
          bubbles: true,
          cancelable: true,
          clipboardData: new DataTransfer(),
        });
        tagPasteEvent.clipboardData?.setData("text/plain", `#${cleanTag}`);
        contentEditor.dispatchEvent(tagPasteEvent);
        // 等待 XHS 话题下拉建议弹出
        await new Promise((resolve) => setTimeout(resolve, 1500));

        // 模拟回车确认选中第一个话题建议
        const enterEvent = new KeyboardEvent("keydown", {
          bubbles: true,
          cancelable: true,
          key: "Enter",
          code: "Enter",
          keyCode: 13,
          which: 13,
        });
        contentEditor.dispatchEvent(enterEvent);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
    contentEditor.blur();

    if (!data.isAutoPublish) {
      await reportPublishResult({ success: true, pendingConfirmation: true });
      return;
    }

    // 关闭可能遮挡发布按钮的下拉菜单/弹窗
    document.body.click();
    await new Promise((resolve) => setTimeout(resolve, 500));

    // 滚动到页面底部,确保发布按钮可见
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const publishButton = findPublishButton();

    if (!publishButton) {
      throw new Error("XHS image publish failed: publish button not found");
    }

    await waitUntilButtonEnabled(publishButton);
    console.log("点击发布按钮");
    // 先报告"已提交"再点击——点击后 XHS 会立即跳转，脚本上下文被销毁
    await reportPublishResult({ success: true, pendingConfirmation: true });
    // 存待回扫标记，跳转到笔记管理页后由 xhs-note-manager content script 抓取作品链接
    try {
      if (publishTraceId && typeof chrome !== "undefined" && chrome.storage?.local) {
        await chrome.storage.local.set({
          xhs_pending_backfill: { traceId: publishTraceId, platform: "DYNAMIC_REDNOTE", ts: Date.now() },
        });
      }
    } catch (e) {
      console.warn("存储待回扫标记失败", e);
    }
    clickElement(publishButton);
    // 等发布请求发出后跳转到笔记管理页，触发 workLink 回扫
    await new Promise((resolve) => setTimeout(resolve, 6000));
    window.location.href = "https://creator.xiaohongshu.com/new/note-manager";
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await reportPublishResult({
      success: false,
      error: message,
    });
    throw error;
  }
}
