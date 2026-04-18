#!/usr/bin/env python3
"""
启动健身追踪器 HTTP 服务器
"""

import http.server
import socketserver
import socket
import sys
import os
from datetime import datetime

# 设置工作目录
WORK_DIR = "/Users/feifei/.qclaw/workspace-agent-753e65b2/fitness-tracker"
PORT = 8000

def get_local_ip():
    """获取本机局域网IP"""
    try:
        # 创建一个UDP套接字
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except:
        return "127.0.0.1"

def main():
    # 切换到工作目录
    os.chdir(WORK_DIR)
    
    # 获取IP地址
    ip = get_local_ip()
    
    print("=" * 60)
    print("🏃 双人健身进度看板 - HTTP 服务器")
    print("=" * 60)
    print(f"📁 服务目录: {WORK_DIR}")
    print(f"🌐 本地访问: http://localhost:{PORT}")
    print(f"📱 手机访问: http://{ip}:{PORT}")
    print(f"📡 局域网访问: http://<你的电脑IP>:{PORT}")
    print("=" * 60)
    print("\n📱 手机访问步骤:")
    print("1. 确保手机和电脑连接同一个 WiFi")
    print("2. 在手机浏览器输入上方'手机访问'的地址")
    print("3. 如果无法访问，检查电脑防火墙是否允许端口 8000")
    print("\n⚡ 服务日志:")
    print("-" * 60)
    
    # 启动服务器
    handler = http.server.SimpleHTTPRequestHandler
    
    # 允许跨域（可选）
    class CORSRequestHandler(handler):
        def end_headers(self):
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
            self.send_header('Pragma', 'no-cache')
            self.send_header('Expires', '0')
            super().end_headers()
    
    with socketserver.TCPServer(("", PORT), CORSRequestHandler) as httpd:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] 服务器已启动，按 Ctrl+C 停止")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print(f"\n[{datetime.now().strftime('%H:%M:%S')}] 服务器已停止")
            sys.exit(0)

if __name__ == "__main__":
    main()