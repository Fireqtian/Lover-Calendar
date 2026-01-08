# 这是给cline用的，不是项目文件。一般不用启动这个，除非怀疑大模型截断
import json
import sys
import httpx
from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse, JSONResponse
import uvicorn

app = FastAPI()

# --- 配置区 ---
# 请务必修改为你真实的中转站 URL 完整路径
TARGET_URL = "https://lmhub.fatui.xyz/v1/chat/completions" 
# --------------

@app.get("/models")
@app.get("/v1/models")
async def list_models():
    return JSONResponse({
        "object": "list",
        "data": [{"id": "gpt-4o", "object": "model"}]
    })
@app.post("/chat/completions")
@app.post("/v1/chat/completions")
async def proxy_completions(request: Request):
    try:
        body = await request.json()
    except:
        return JSONResponse({"error": "Invalid JSON"}, status_code=400)
    headers = dict(request.headers)
    headers.pop("host", None)
    headers.pop("content-length", None)
    headers.pop("connection", None)
    print(f"\n\n\033[1;33m[RAW REQUEST START]\033[0m")
    print(f"Target: {TARGET_URL}")
    print("-" * 80)
    async def event_generator():
        # verify=False 避免本地环境 SSL 报错
        async with httpx.AsyncClient(verify=False) as client:
            try:
                # 使用较大的 timeout，防止长响应断开
                async with client.stream(
                    "POST", TARGET_URL, json=body, headers=headers, timeout=600.0
                ) as response:
                    
                    if response.status_code != 200:
                        err = await response.aread()
                        print(f"\033[1;31m[HTTP ERROR]\033[0m {response.status_code}")
                        print(err.decode())
                        yield f"data: {err.decode()}\n\n"
                        return
                    # 逐行读取上游返回的数据
                    async for line in response.aiter_lines():
                        if not line:
                            continue
                        
                        # 【核心点】：直接在终端打印每一行原始返回体
                        # 使用绿色的 data: 标记开头，方便查看
                        if line.startswith("data: "):
                            # 打印原始 JSON 字符串
                            print(f"\033[1;32m{line}\033[0m")
                        else:
                            # 打印非 data 开头的行（例如 keep-alive 空行）
                            print(f"\033[1;30m{line}\033[0m")
                        
                        # 强制刷新缓冲区，确保实时看到每条消息
                        sys.stdout.flush()
                        # 原封不动回传给 Cline
                        yield f"{line}\n\n"
            except Exception as e:
                print(f"\n\033[1;31m[CONNECTION ERROR]\033[0m {str(e)}")
                yield f"data: {{\"error\": \"{str(e)}\"}}\n\n"
    return StreamingResponse(event_generator(), media_type="text/event-stream")
if __name__ == "__main__":
    print("\033[1;34m" + "="*80)
    print(" [DEBUG PROXY] 原始 JSON 流监听已启动")
    print(" [URL] http://127.0.0.1:8100")
    print(" 终端将直接显示上游 API 返回的每一行 'data: {...}'")
    print("="*80 + "\033[0m")
    
    uvicorn.run(app, host="127.0.0.1", port=8100, log_level="error")
