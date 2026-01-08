@echo off
chcp 65001 >nul
title 情侣日历服务器启动器
color 0A

echo ========================================
echo      情侣日历系统启动脚本
echo ========================================
echo.

REM 检查Python是否已安装
python --version >nul 2>&1
if errorlevel 1 (
    echo [错误] 未找到Python，请先安装Python 3.7+
    echo 下载地址: https://www.python.org/downloads/
    pause
    exit /b 1
)

echo [✓] Python已安装
python --version

REM 切换到脚本所在目录
cd /d "%~dp0"
echo [✓] 工作目录: %cd%

REM 检查虚拟环境
if exist "venv\" (
    echo [✓] 找到虚拟环境，正在激活...
    call venv\Scripts\activate
) else (
    echo [i] 未找到虚拟环境，将使用系统Python
)

REM 检查依赖包
echo.
echo [i] 检查依赖包...
python -c "import flask" >nul 2>&1
if errorlevel 1 (
    echo [i] 正在安装依赖包...
    pip install -r requirements.txt
    if errorlevel 1 (
        echo [错误] 依赖包安装失败
        pause
        exit /b 1
    )
    echo [✓] 依赖包安装成功
) else (
    echo [✓] 依赖包已安装
)

REM 检查是否已有服务器在运行
echo.
echo [i] 检查端口占用...
netstat -ano | findstr :5000 >nul
if not errorlevel 1 (
    echo [i] 检测到已有服务器在运行 (端口5000)
    choice /c YN /n /m "是否停止现有进程并重新启动？(Y/N)"
    if errorlevel 2 (
        echo [i] 保持现有服务器运行
        goto :open_browser
    )
    echo [i] 正在停止现有进程...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5000 ^| findstr LISTENING') do (
        taskkill /PID %%a /F >nul 2>&1
    )
    timeout /t 2 /nobreak >nul
)

REM 启动服务器
echo.
echo [i] 正在启动情侣日历服务器...
echo [i] 默认账户：alice/alice123, bob/bob123
echo [i] 访问地址：http://localhost:5000
echo ========================================
echo.
echo 服务器启动中... 按 Ctrl+C 停止服务器
echo.

python app.py

if errorlevel 1 (
    echo [错误] 服务器启动失败
    pause
    exit /b 1
)

:open_browser
echo.
echo [i] 正在打开浏览器...
timeout /t 1 /nobreak >nul
start http://localhost:5000
echo [✓] 请在浏览器中访问 http://localhost:5000
echo.
pause
