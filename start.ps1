# 情侣日历系统启动脚本 (PowerShell版本)
# 使用方法：右键点击文件 -> "使用PowerShell运行"
# 或者：在PowerShell中执行：.\start.ps1

Write-Host "========================================`n      情侣日历系统启动脚本`n========================================" -ForegroundColor Cyan

# 设置控制台编码为UTF-8
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# 检查Python是否已安装
function Check-Python {
    try {
        $pythonVersion = python --version 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Python已安装: $pythonVersion" -ForegroundColor Green
            return $true
        }
    } catch {
        # 忽略错误
    }
    
    Write-Host "❌ 未找到Python，请先安装Python 3.7+" -ForegroundColor Red
    Write-Host "下载地址: https://www.python.org/downloads/" -ForegroundColor Yellow
    return $false
}

# 检查端口是否被占用
function Check-Port {
    $port = 5000
    try {
        $listener = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
        if ($listener) {
            Write-Host "⚠️  检测到已有服务器在运行 (端口 $port)" -ForegroundColor Yellow
            
            $response = Read-Host "是否停止现有进程并重新启动？(Y/N)"
            if ($response -notmatch '^[Yy]') {
                Write-Host "ℹ️  保持现有服务器运行" -ForegroundColor Blue
                Start-Browser
                exit
            }
            
            Write-Host "ℹ️  正在停止现有进程..." -ForegroundColor Yellow
            foreach ($conn in $listener) {
                Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
            }
            Start-Sleep -Seconds 2
        }
    } catch {
        # 忽略错误
    }
}

# 检查依赖包
function Check-Dependencies {
    Write-Host "`nℹ️  检查依赖包..." -ForegroundColor Blue
    
    try {
        python -c "import flask, flask_cors, sqlite3" 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ 依赖包已安装" -ForegroundColor Green
            return $true
        }
    } catch {
        # 依赖包未安装
    }
    
    Write-Host "ℹ️  正在安装依赖包..." -ForegroundColor Yellow
    
    # 检查requirements.txt是否存在
    if (Test-Path "requirements.txt") {
        try {
            pip install -r requirements.txt
            if ($LASTEXITCODE -ne 0) {
                throw "安装失败"
            }
            Write-Host "✅ 依赖包安装成功" -ForegroundColor Green
            return $true
        } catch {
            Write-Host "❌ 依赖包安装失败: $_" -ForegroundColor Red
            return $false
        }
    } else {
        Write-Host "❌ 未找到 requirements.txt 文件" -ForegroundColor Red
        return $false
    }
}

# 启动浏览器
function Start-Browser {
    $url = "http://localhost:5000"
    Write-Host "`nℹ️  正在打开浏览器..." -ForegroundColor Blue
    try {
        Start-Process $url
        Write-Host "✅ 请在浏览器中访问 $url" -ForegroundColor Green
    } catch {
        Write-Host "⚠️  无法自动打开浏览器，请手动访问: $url" -ForegroundColor Yellow
    }
}

# 主程序
function Main {
    # 1. 检查Python
    if (-not (Check-Python)) {
        Read-Host "按Enter键退出"
        exit 1
    }
    
    # 2. 检查依赖包
    if (-not (Check-Dependencies)) {
        Read-Host "按Enter键退出"
        exit 1
    }
    
    # 3. 检查端口占用
    Check-Port
    
    # 4. 启动服务器
    Write-Host "`nℹ️  正在启动情侣日历服务器..." -ForegroundColor Cyan
    Write-Host "ℹ️  默认账户：alice/alice123, bob/bob123" -ForegroundColor Cyan
    Write-Host "ℹ️  访问地址：http://localhost:5000" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "`n服务器启动中... 按 Ctrl+C 停止服务器`n" -ForegroundColor Yellow
    
    # 保存当前目录
    $currentDir = Get-Location
    
    # 检查虚拟环境
    if (Test-Path "venv\Scripts\activate.ps1") {
        Write-Host "✅ 找到虚拟环境，正在激活..." -ForegroundColor Green
        & .\venv\Scripts\Activate.ps1
    } else {
        Write-Host "ℹ️  未找到虚拟环境，将使用系统Python" -ForegroundColor Blue
    }
    
    # 启动服务器
    try {
        python app.py
    } catch {
        Write-Host "❌ 服务器启动失败: $_" -ForegroundColor Red
        Set-Location $currentDir
        Read-Host "按Enter键退出"
        exit 1
    }
    
    # 恢复目录并启动浏览器（如果服务器正常退出）
    Set-Location $currentDir
    Start-Browser
}

# 执行主程序
Main

# 防止窗口立即关闭
Write-Host "`n"
Read-Host "按Enter键退出"
