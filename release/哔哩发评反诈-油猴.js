// ==UserScript==
// @name         哔哩发评反诈
// @namespace    http://tampermonkey.net/
// @version      3.6
// @description  评论发送后自动检测状态，避免被发送成功的谎言所欺骗！
// @author       freedom-introvert & ChatGPT
// @match        https://*.bilibili.com/*
// @run-at       document-idle
// @grant        GM.xmlHttpRequest
// @license      GPL
// @downloadURL https://update.greasyfork.org/scripts/496537/%E5%93%94%E5%93%A9%E5%8F%91%E8%AF%84%E5%8F%8D%E8%AF%88.user.js
// @updateURL https://update.greasyfork.org/scripts/496537/%E5%93%94%E5%93%A9%E5%8F%91%E8%AF%84%E5%8F%8D%E8%AF%88.meta.js
// ==/UserScript==

const waitTime = 8000;//评论发送后的等待时间，单位毫秒
const closeCountdown = 3;

const sortByTime = 0;
const SORT_MODE_TIME = 2;

const originalFetch = unsafeWindow.fetch;//注意是unsafeWindow，不是window，使用 GM.xmlHttpRequest 换掉window里的fecth将不起作用

// Replace the fetch function with a custom one
unsafeWindow.fetch = async function (...args) {
    // Call the original fetch function and wait for the response
    var response = await originalFetch.apply(this, args);

    // Clone the response to read its content without altering the original response
    var clonedResponse = response.clone();

    // Read the response content as text
    clonedResponse.text().then(content => {
        // Log the URL of the fetch request to the console
        var url = args[0];
        //console.log('Fetch request URL:', url);
        // Log the response content to the console
        //console.log('Fetch response content:', content);
        if (url.startsWith("//api.bilibili.com/x/v2/reply/add")) {
            handleAddCommentResponse(url, JSON.parse(content));
        }
    });

    // Return the original response so that the fetch call continues to work as normal
    return response;
};

//动态shadowBan检测
window.onload = function () {
    const currentURL = window.location.href;
    const hostname = window.location.hostname;
    let id = null;

    if (hostname === 't.bilibili.com') {
        // 提取 t.bilibili.com URL 中的数字部分
        const urlPath = window.location.pathname;
        id = urlPath.split('/')[1];
    } else if (hostname === 'www.bilibili.com') {
        // 提取 www.bilibili.com/opus URL 中的数字部分
        const urlPath = window.location.pathname;
        const pathParts = urlPath.split('/');
        if (pathParts[1] === 'opus') {
            id = pathParts[2];
        }
    }

    if (id) {
        console.log('Dynamic ID:', id);
        handleCheckDynamic(id);
    }

}

console.log(window.fetch)
console.log("反诈脚本已加载")

//
var dialogHTML = `
        <style>
        #progress-overlay {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: transparent;
            pointer-events: none;
            z-index: 999;
        }

        #progress-title{
            display: block;
            font-size: 19px;
            margin-block-start: 0.5em;
            margin-block-end: 1em;
            margin-inline-start: 0px;
            margin-inline-end: 0px;
            font-weight: bold;
            unicode-bidi: isolate;
        }

        #progress-message{
            display: block;
            font-size: 16px;
            margin-block-start: 1em;
            margin-block-end: 1em;
            margin-inline-start: 0px;
            margin-inline-end: 0px;
            unicode-bidi: isolate;
        }

        #progress-dialog {
            display: none;
            position: fixed;
            right: 16px;
            bottom: 16px;
            left: auto;
            top: auto;
            transform: none;
            width: min(420px, calc(100vw - 24px));
            max-width: calc(100vw - 24px);
            padding: 14px;
            box-sizing: border-box;
            background-color: #fff;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
            border-radius: 8px;
            z-index: 2147483647;
            pointer-events: auto;
        }

        #progress-bar-container {
            width: 100%;
            height: 5px;
            margin-top: 30px;
            background-color: #ddd;
            overflow: hidden;
            position: relative;
            margin-bottom: 20px;
        }

        .progress-bar {
            width: 0;
            height: 20px;
            background-color: #FB7299;
            text-align: center;
            color: white;
            line-height: 20px;
            
        }


        /* 不确定进度的线性进度条 摘抄自mdui*/
        .progress-bar-indeterminate {
            background-color: #FB7299;

            &::before {
                position: absolute;
                top: 0;
                bottom: 0;
                left: 0;
                background-color: inherit;
                animation: mdui-progress-indeterminate 2s linear infinite;
                content: ' ';
                will-change: left, width;
            }

            &::after {
                position: absolute;
                top: 0;
                bottom: 0;
                left: 0;
                background-color: inherit;
                animation: mdui-progress-indeterminate-short 2s linear infinite;
                content: ' ';
                will-change: left, width;
            }
        }

        @keyframes mdui-progress-indeterminate {
            0% {
                left: 0;
                width: 0;
            }

            50% {
                left: 30%;
                width: 70%;
            }

            75% {
                left: 100%;
                width: 0;
            }
        }

        @keyframes mdui-progress-indeterminate-short {
            0% {
                left: 0;
                width: 0;
            }

            50% {
                left: 0;
                width: 0;
            }

            75% {
                left: 0;
                width: 25%;
            }

            100% {
                left: 100%;
                width: 0;
            }
        }

        #dialog-actions {
            display: flex;
            justify-content: flex-end;
            gap: 8px;
            margin-top: 20px;
        }

        #close-button,
        #retry-button {
            display: inline-block;
            padding: 10px 15px;
            background-color: #fff;
            color: #FB7299;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            text-align: center;
            font-size: 14px;
            font-weight: bold;
            float: right;
            transition: all 0.2s;
        }

        #close-button:hover,
        #retry-button:hover {
            background-color: #F0F0F0;
        }

        #retry-button {
            display: none;
        }

        .shadowban-scanner-message {
            --message-background-color: rgb(255, 0, 0, 0.2);
            color: var(--md-sys-color-on-primary);
            padding: 1em;
            border-radius: 0.5em;
            background: var(--message-background-color);
            margin: 1em 0px 0px;
        }

        </style>
        <div id="progress-overlay"></div>
        <div id="progress-dialog">
            <h3 id="progress-title">Progress</h3>
            <p id="progress-message"></p>
            <div id="progress-bar-container">
                <div id="progressBar" class="progress-bar"></div>
            </div>
            <div id="dialog-actions">
                <button id="retry-button">重新检测</button>
                <button id="close-button">取消检测</button>
            </div>
        </div>
        `
document.body.insertAdjacentHTML('beforeend', dialogHTML);

const ProgressDialog = {
    closeTimer: null,
    retryHandler: null,
    cancelled: false,
    show: function () {
        this.clearCloseTimer();
        this.cancelled = false;
        document.getElementById('close-button').textContent = '取消检测';
        document.getElementById('progress-overlay').style.display = 'none';
        document.getElementById('progress-dialog').style.display = 'block';
    },
    hide: function () {
        document.getElementById('progress-overlay').style.display = 'none';
        document.getElementById('progress-dialog').style.display = 'none';
    },
    setTitle: function (title) {
        document.getElementById('progress-title').textContent = title;
    },
    setMessage: function (message) {
        document.getElementById('progress-message').innerText = message;
    },
    setRetryHandler: function (handler) {
        this.retryHandler = handler;
        document.getElementById('retry-button').style.display = handler ? 'inline-block' : 'none';
    },
    setRetryButtonText: function (text) {
        document.getElementById('retry-button').textContent = text;
    },
    startCloseCountdown: function (message) {
        this.setRetryHandler(null);
        const closeButton = document.getElementById('close-button');
        let remaining = closeCountdown;
        closeButton.textContent = `${remaining}秒后关闭`;
        this.clearCloseTimer();
        this.closeTimer = setInterval(() => {
            remaining -= 1;
            if (remaining <= 0) {
                this.clearCloseTimer();
                this.hide();
                closeButton.textContent = '取消检测';
                return;
            }
            closeButton.textContent = `${remaining}秒后关闭`;
        }, 1000);
        if (message) {
            this.setMessage(`${message}\n\n${closeCountdown}秒后自动关闭`);
        }
    },
    clearCloseTimer: function () {
        if (this.closeTimer) {
            clearInterval(this.closeTimer);
            this.closeTimer = null;
        }
    },
    setProgress: function (progress) {
        const progressBar = document.getElementById('progressBar');
        progressBar.style.width = progress + '%';
    },
    setIndeterminate: function (indeterminate) {
        var progressBar = document.getElementById('progressBar');
        if (indeterminate) {
            progressBar.className = "progress-bar-indeterminate";
            progressBar.style.width = "30%"
        } else {
            progressBar.className = "progress-bar";
            progressBar.style.width = "0"
        }
    }
};

document.getElementById('close-button').addEventListener('click', function () {
    if (ProgressDialog.retryHandler || !ProgressDialog.closeTimer) {
        ProgressDialog.cancelled = true;
        ProgressDialog.setRetryHandler(null);
        ProgressDialog.setIndeterminate(false);
        ProgressDialog.setTitle("已取消检测");
        ProgressDialog.startCloseCountdown("本次检测已取消");
        return;
    }
    ProgressDialog.clearCloseTimer();
    ProgressDialog.hide();
});

document.getElementById('retry-button').addEventListener('click', function () {
    if (ProgressDialog.retryHandler) {
        ProgressDialog.cancelled = false;
        ProgressDialog.clearCloseTimer();
        ProgressDialog.retryHandler();
    }
});

function sleep(time) {
    return new Promise((resolve) => setTimeout(resolve, time));
}

async function handleAddCommentResponse(url, responseJson) {
    console.log(url);
    console.log(responseJson);
    console.log(responseJson.code);
    if (responseJson.code == 0) {
        var data = responseJson.data;
        var reply = data.reply;

        var oid = reply.oid;
        var type = reply.type;
        var rpid = reply.rpid;
        var root = reply.root;

        console.log(`${data.success_toast}，${waitTime / 1000}秒后使用游客身份检查评论`);
        ProgressDialog.show();
        await checkGuestComment(reply, oid, type, rpid, root, true, false);
    }
}

async function checkGuestComment(reply, oid, type, rpid, root, wait, useCookie) {
    try {
        if (wait) {
            await sleepAndShowInDialog(waitTime);
        }
        if (ProgressDialog.cancelled) {
            return;
        }
        ProgressDialog.setIndeterminate(true);
        ProgressDialog.setTitle(useCookie ? "账号复核中……" : "游客检测中……");
        ProgressDialog.setRetryHandler(null);

        let found = false;
        if (root == 0) {
            ProgressDialog.setMessage(useCookie ? "带 cookie 检查游客不可见评论是否仅本人可见" : "查找游客可见的评论");
            const resp = await getMainCommentList(oid, type, 0, SORT_MODE_TIME, useCookie, rpid);
            if (ProgressDialog.cancelled) {
                return;
            }
            if (resp.code !== 0) {
                showErrorResult((useCookie ? "账号复核" : "游客获取") + "评论列表失败：" + (resp.message || resp.code));
                return;
            }
            found = !!findReplies(resp.data && resp.data.replies, rpid);
        } else {
            for (let page = 0; page < 100; page++) {
                ProgressDialog.setMessage(useCookie ? `带 cookie 复核回复，第${page + 1}页` : `查找游客可见的回复，第${page + 1}页`);
                const resp = await fetchBilibiliCommentReplies(oid, type, root, page, sortByTime, useCookie);
                if (ProgressDialog.cancelled) {
                    return;
                }
                if (resp.code === 12022) {
                    break;
                }
                if (resp.code !== 0) {
                    showErrorResult((useCookie ? "账号复核" : "游客获取") + "回复失败：" + (resp.message || resp.code));
                    return;
                }
                const replies = resp.data && resp.data.replies;
                if (!replies || replies.length === 0) {
                    break;
                }
                if (findReplies(replies, rpid)) {
                    found = true;
                    break;
                }
            }
        }

        if (found) {
            if (useCookie) {
                showOnlySelfVisibleResult(reply);
            } else {
                showOkResult(reply);
            }
        } else {
            if (useCookie) {
                showHiddenOrUnderReviewResult(reply);
            } else {
                showPendingResult(reply, oid, type, rpid, root);
            }
        }
    } catch (error) {
        showErrorResult((useCookie ? "账号复核" : "游客检测") + "失败：" + error.message);
    }
}

function showPendingResult(reply, oid, type, rpid, root) {
    if (ProgressDialog.cancelled) {
        return;
    }
    ProgressDialog.setIndeterminate(false);
    ProgressDialog.setProgress(0);
    ProgressDialog.setTitle("游客已确认不可见");
    ProgressDialog.setMessage("游客视角已确认看不到这条评论。当前明确结论：游客不可见。\n\n下一步将带 cookie 复核，以区分『仅本人可见』和『审核中/已隐藏』。\n\n你的评论：" + reply.content.message);
    ProgressDialog.setRetryHandler(() => {
        ProgressDialog.cancelled = false;
        ProgressDialog.clearCloseTimer();
        ProgressDialog.setRetryHandler(null);
        ProgressDialog.setRetryButtonText("重新检测");
        checkGuestComment(reply, oid, type, rpid, root, false, true);
    });
    ProgressDialog.setRetryButtonText("重新检测（带 cookie）");
    document.getElementById('close-button').textContent = '取消检测';
}

function showOnlySelfVisibleResult(reply) {
    ProgressDialog.setIndeterminate(false);
    ProgressDialog.setProgress(100);
    ProgressDialog.setTitle("明确结果：仅本人可见");
    ProgressDialog.setMessage("带 cookie 复核后，账号可见，但游客不可见。当前明确结论：仅本人可见。\n\n你的评论：" + reply.content.message);
    ProgressDialog.setRetryHandler(null);
    ProgressDialog.clearCloseTimer();
    ProgressDialog.startCloseCountdown("明确结果：仅本人可见");
}

function showHiddenOrUnderReviewResult(reply) {
    ProgressDialog.setIndeterminate(false);
    ProgressDialog.setProgress(0);
    ProgressDialog.setTitle("明确结果：游客不可见");
    ProgressDialog.setMessage("带 cookie 复核后，账号也看不到这条评论。当前更可能是『审核中』或『已隐藏/删除』，但在本脚本的游客检测范围内，结论是：游客不可见。\n\n你的评论：" + reply.content.message);
    ProgressDialog.setRetryHandler(null);
    ProgressDialog.clearCloseTimer();
    ProgressDialog.startCloseCountdown("明确结果：游客不可见");
}

async function handleCheckDynamic(id) {
    var resp = await fetchDynamic(id, false);
    console.log(resp);
    if (resp.code == -352) {
        addDynamicShadowBannedHint("检测到此动态被shadowBan，仅自己可见！（也可能是误判了，你可以在无痕模式去验证一下）");
    } else if (resp.code == 4101131) {
        console.log("检测到动态被shadowBan！");
        addDynamicShadowBannedHint("检测到此动态被shadowBan，仅自己可见！（可能你转发到动态的评论被ShadowBan）");
    } else if (resp.code == 500) {
        console.log("检测到动态被shadowBan！");
        addDynamicShadowBannedHint("检测到此动态被shadowBan，仅自己可见!（可能你转发到动态的评论疑似审核中）");
    } else if (resp.code == 0) {
        console.log("检查到此动态正常，没被shadowBan");
    } else {
        console.log("动态检查出错：未知的响应码", resp);
    }
}

function findReplies(replies, rpid) {
    for (var i in replies) {
        var reply = replies[i];
        console.log(reply);
        if (reply.rpid == rpid) {
            return reply;
        }
    }
    return null;
}

function findReplyInReplies(replies, rpid) {
    for (var i in replies) {
        var reply = replies[i];
        console.log(reply);
        var subReplies = reply.replies;
        console.log(subReplies)
        for (var j in subReplies) {
            var subReply = subReplies[j];
            console.log(subReply);
            if (subReply.rpid == rpid) {
                return subReply;
            }
        }
    }
    return null;
}

async function sleepAndShowInDialog(sleepTime) {
    ProgressDialog.setTitle("等待检查中");
    var sleepCount = sleepTime / 10;
    for (var i = 0; i <= sleepCount; i++) {
        await sleep(10);
        ProgressDialog.setMessage(`等待 ${i * 10}/${sleepTime}ms 后检查评论`)
        ProgressDialog.setProgress(100 / sleepCount * i);
    }
    ProgressDialog.setProgress(100);
}

/**
 * 
 * @param {*} oid 
 * @param {*} type 
 * @param {*} next 
 * @param {*} mode 评论排序模式 2为按时间
 * @param {*} isLogin 是否携带cookie
 * @param {*} seek_rpid 定位rpid
 * @returns 
 */

async function getMainCommentList(oid, type, next, mode,isLogin,seek_rpid) {  
    let url = `https://api.bilibili.com/x/v2/reply/main?oid=${oid}&type=${type}&next=${next}&mode=${mode}` + (seek_rpid ? `&seek_rpid=${seek_rpid}` : "")
    const req = {
        url,
        anonymous: !isLogin
    }

    if (isLogin) {
        req.headers = { "cookie": getBuvid3Cookie() };
    }
    let response = (await GM.xmlHttpRequest(req).catch(e => console.error(e))).response;
    let resp = JSON.parse(response);
    console.log("获取主评论列表，携带cookie："+isLogin,url,resp)
    return resp;
}

/**
 * 获取某评论的回复列表
 * @param {*} oid 
 * @param {*} type 
 * @param {*} root 
 * @param {*} pn 
 * @param {*} sort 
 * @param {*} hasCookie 
 * @returns 
 */
async function fetchBilibiliCommentReplies(oid, type, root, pn, sort, hasCookie) {
    const url = new URL('https://api.bilibili.com/x/v2/reply/reply');
    const params = { oid, type, root, pn, sort };
    url.search = new URLSearchParams(params).toString();

    try {
        const response = await originalFetch(url, hasCookie ? { credentials: 'include' } : { credentials: 'omit' });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json(); // Return JSON object
    } catch (error) {
        throw error; // Rethrow the error
    }
}

/**
 * 由于需要残次cookie，浏览器js无法自定义cookie，此方法废弃，需要翻全页
 * 
 * 使用Main api 结合 seek_rpid 参数定位评论
 * 如果seek_rpid 的评论id是一个回复别人的评论，
 * 那么它会出现在某个根评论的预览评论列表里
 * @param {*} oid 
 * @param {*} type 
 * @param {*} seek_rpid 要查看的rpid
 * @param {*} next 页码（从零开始）
 * @param {*} mode 排序模式
 * @param {*} hasCookie 
 * @returns 
 */
async function fetchBilibiliCommentsByMainApiUseSeekRpid(oid, type, seek_rpid, next, mode, hasCookie) {
    const url = new URL('https://api.bilibili.com/x/v2/reply/main');
    const params = { oid, type, seek_rpid, next, mode };
    url.search = new URLSearchParams(params).toString();

    try {
        const response = await originalFetch(url, hasCookie ? { credentials: 'include' } : { credentials: 'omit' });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json(); // Return JSON object
    } catch (error) {
        throw error; // Rethrow the error
    }
}


async function fetchDynamic(id, hasCookie) {
    const url = new URL('https://api.bilibili.com/x/polymer/web-dynamic/v1/detail');
    const params = { id };
    url.search = new URLSearchParams(params).toString();

    try {
        const response = await originalFetch(url, hasCookie ? { credentials: 'include' } : { credentials: 'omit' });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json(); // Return JSON object
    } catch (error) {
        throw error; // Rethrow the error
    }
}


function showOkResult(reply) {
    showResult("恭喜，无账号状态下找到了你的评论，你的评论正常！\n\n你的评论：" + reply.content.message);
}

function showShadowBanResult(reply) {
    showResult("你被骗了，此评论被shadow ban（仅自己可见）！\n\n你的评论：" + reply.content.message);
}

function showQuickDeleteResult(reply) {
    showResult("你评论没了，此评论已被系统秒删！刷新评论区也许就不见了，复制留个档吧。\n\n你的评论：" + reply.content.message);
}

function showSusResult(reply) {
    showResult(`
                你评论状态有点可疑，虽然无账号翻找评论区获取不到你的评论，但是无账号可通过
                https://api.bilibili.com/x/v2/reply/reply?oid=${reply.oid}&pn=1&ps=20&root=${reply.rpid}&type=${reply.type}&sort=0
                获取你的评论，疑似评论区被戒严或者这是你的视频。

                你的评论：${reply.content.message}
            `);
}

function showResult(message) {
    ProgressDialog.setIndeterminate(false);
    ProgressDialog.setProgress(100);
    ProgressDialog.setTitle("检查完毕");
    ProgressDialog.startCloseCountdown(message);
}

function showErrorResult(message) {
    ProgressDialog.setIndeterminate(false);
    ProgressDialog.setProgress(0);
    ProgressDialog.setTitle("发生错误");
    ProgressDialog.startCloseCountdown(message);
}

//样式抄自X（Twitter）的shadowBan检查器，插件可在Chrome商店搜索
function addDynamicShadowBannedHint(message) {
    const biliDynContent = document.querySelector('.bili-dyn-content');

    if (biliDynContent) {
        const shadowbanMessage = document.createElement('div');
        shadowbanMessage.className = 'shadowban-scanner-message';
        shadowbanMessage.style.setProperty('--md-sys-color-on-primary', 'rgb(15, 20, 25)');

        const messageSpan = document.createElement('span');
        messageSpan.textContent = message;

        shadowbanMessage.appendChild(messageSpan);
        biliDynContent.appendChild(shadowbanMessage);
    }
}

function getBuvid3Cookie() {
    var cookies = document.cookie.split(';');
    for (var i = 0; i < cookies.length; i++) {
        var cookie = cookies[i].trim();
        if (cookie.startsWith('buvid3=')) {
            return cookie;
        }
    }
    return null;
}
