/**
 * GitHub Proxy for Deno Deploy
 * Converted from Cloudflare Worker
 */

/**
 * static files (404.html, sw.js, conf.js)
 */
const ASSET_URL = 'https://crazypeace.github.io/gh-proxy/';
// 前缀，如果自定义路由为example.com/gh/*，将PREFIX改为 '/gh/'，注意，少一个杠都会错！
const PREFIX = '/';
// 分支文件使用jsDelivr镜像的开关，0为关闭，默认关闭
const Config = {
    jsdelivr: 0
};

const whiteList: string[] = []; // 白名单，路径里面有包含字符的才会通过，e.g. ['/username/']

const PREFLIGHT_INIT: ResponseInit = {
    status: 204,
    headers: new Headers({
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET,POST,PUT,PATCH,TRACE,DELETE,HEAD,OPTIONS',
        'access-control-max-age': '1728000',
    }),
};

const exp1 = /^(?:https?:\/\/)?github\.com\/.+?\/.+?\/(?:releases|archive)\/.*$/i;
const exp2 = /^(?:https?:\/\/)?github\.com\/.+?\/.+?\/(?:blob|raw)\/.*$/i;
const exp3 = /^(?:https?:\/\/)?github\.com\/.+?\/.+?\/(?:info|git-).*$/i;
const exp4 = /^(?:https?:\/\/)?raw\.(?:githubusercontent|github)\.com\/.+?\/.+?\/.+?\/.+$/i;
const exp5 = /^(?:https?:\/\/)?gist\.(?:githubusercontent|github)\.com\/.+?\/.+?\/.+$/i;
const exp6 = /^(?:https?:\/\/)?github\.com\/.+?\/.+?\/tags.*$/i;
const exp7 = /^(?:https?:\/\/)?api\.github\.com\/.*$/i;
const exp8 = /^(?:https?:\/\/)?git\.io\/.*$/i;
const exp9 = /^(?:https?:\/\/)?gitlab\.com\/.*$/i;

function makeRes(body: BodyInit, status = 200, headers: Record<string, string> = {}): Response {
    headers['access-control-allow-origin'] = '*';
    return new Response(body, { status, headers });
}

function newUrl(urlStr: string): URL | null {
    try {
        return new URL(urlStr);
    } catch (err) {
        return null;
    }
}

function checkUrl(u: string): boolean {
    for (const regex of [exp1, exp2, exp3, exp4, exp5, exp6, exp7, exp8, exp9]) {
        if (u.search(regex) === 0) {
            return true;
        }
    }
    return false;
}

async function fetchHandler(req: Request): Promise<Response> {
    const urlStr = req.url;
    const urlObj = new URL(urlStr);
    
    console.log("in:" + urlStr);

    let path = urlObj.searchParams.get('q');
    if (path) {
        return Response.redirect('https://' + urlObj.host + PREFIX + path, 301);
    }

    path = urlObj.href.substr(urlObj.origin.length + PREFIX.length);
    console.log("path:" + path);

    // 判断有没有嵌套自己调用自己
    const exp0 = 'https:/' + urlObj.host + '/';
    console.log("exp0:" + exp0);
    while (path.startsWith(exp0)) {
        console.log("in while");
        path = path.replace(exp0, '');
    }
    console.log("path:" + path);

    // cfworker 会把路径中的 `//` 合并成 `/`
    path = path.replace(/^https?:\/+/, 'https://');
    console.log("path:" + path);

    if (path.search(exp1) === 0 || path.search(exp3) === 0 || path.search(exp4) === 0 || 
        path.search(exp5) === 0 || path.search(exp6) === 0 || path.search(exp7) === 0 || 
        path.search(exp8) === 0 || path.search(exp9) === 0) {
        
        console.log("exp 1,3,4,5,6,7,8,9");
        return httpHandler(req, path);
    } else if (path.search(exp2) === 0) {
        if (Config.jsdelivr) {
            const newUrl = path.replace('/blob/', '@').replace(/^(?:https?:\/\/)?github\.com/, 'https://cdn.jsdelivr.net/gh');
            return Response.redirect(newUrl, 302);
        } else {
            path = path.replace('/blob/', '/raw/');
            return httpHandler(req, path);
        }
    } else if (path.search(exp4) === 0) {
        const newUrl = path.replace(/(?<=com\/.+?\/.+?)\/(.+?\/)/, '@$1').replace(/^(?:https?:\/\/)?raw\.(?:githubusercontent|github)\.com/, 'https://cdn.jsdelivr.net/gh');
        return Response.redirect(newUrl, 302);
    } else if (path === 'perl-pe-para') {
        const perlstr = 'perl -pe';
        const responseText = 's#(bash.*?\\.sh)([^/\\w\\d])#\\1 | ' + perlstr + ' "\\$(curl -L ' + urlObj.origin + '/perl-pe-para)" \\2#g; ' +
                       's# (git)# https://\\1#g; ' +
                       's#(http.*?git[^/]*?/)#' + urlObj.origin + '/\\1#g';
        return new Response(responseText, { 
            status: 200, 
            headers: {
                'Content-Type': 'text/plain',
                'Cache-Control': 'max-age=300'
            }
        });
    } else {
        console.log("fetch " + ASSET_URL + path);
        return fetch(ASSET_URL + path);
    }
}

function httpHandler(req: Request, pathname: string): Response | Promise<Response> {
    const reqHdrRaw = req.headers;

    // preflight
    if (req.method === 'OPTIONS' && reqHdrRaw.has('access-control-request-headers')) {
        return new Response(null, PREFLIGHT_INIT);
    }

    const reqHdrNew = new Headers(reqHdrRaw);

    let urlStr = pathname;
    let flag = !Boolean(whiteList.length);
    for (const item of whiteList) {
        if (urlStr.includes(item)) {
            flag = true;
            break;
        }
    }
    if (!flag) {
        return new Response("blocked", { status: 403 });
    }
    if (urlStr.startsWith('git')) {
        urlStr = 'https://' + urlStr;
    }

    console.log("urlStr " + urlStr);

    const urlObj = newUrl(urlStr);
    if (!urlObj) {
        return new Response("Invalid URL", { status: 400 });
    }

    const reqInit: RequestInit = {
        method: req.method,
        headers: reqHdrNew,
        redirect: 'manual',
        body: req.body
    };
    return proxy(urlObj, reqInit);
}

async function proxy(urlObj: URL, reqInit: RequestInit): Promise<Response> {
    const res = await fetch(urlObj.href, reqInit);
    const resHdrOld = res.headers;
    const resHdrNew = new Headers(resHdrOld);

    const status = res.status;

    if (resHdrNew.has('location')) {
        const _location = resHdrNew.get('location');
        if (_location && checkUrl(_location)) {
            resHdrNew.set('location', PREFIX + _location);
        } else if (_location) {
            reqInit.redirect = 'follow';
            const newUrlObj = newUrl(_location);
            if (newUrlObj) {
                return proxy(newUrlObj, reqInit);
            }
        }
    }
    resHdrNew.set('access-control-expose-headers', '*');
    resHdrNew.set('access-control-allow-origin', '*');

    resHdrNew.delete('content-security-policy');
    resHdrNew.delete('content-security-policy-report-only');
    resHdrNew.delete('clear-site-data');

    return new Response(res.body, {
        status,
        headers: resHdrNew,
    });
}

// Deno Deploy handler
async function handler(req: Request): Promise<Response> {
    try {
        return await fetchHandler(req);
    } catch (err) {
        console.error('Error:', err);
        return makeRes('Deno Deploy error:\n' + (err as Error).stack, 502);
    }
}

// Export the handler for Deno Deploy
export default { fetch: handler };