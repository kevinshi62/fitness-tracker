// GitHub Gist 同步模块
class GitHubSync {
    constructor() {
        this.baseURL = 'https://api.github.com';
        this.gistId = null;
        this.gistFilename = 'fitness-tracker-data.json';
    }

    // 设置 Token
    setToken(token) {
        this.token = token;
        this.headers = {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
        };
    }

    // 加密数据
    async encryptData(data, password) {
        if (!password) return data;
        
        try {
            // 简单加密实现 - 实际应用中应使用更安全的加密方式
            const text = JSON.stringify(data);
            const encoder = new TextEncoder();
            const dataBuffer = encoder.encode(text);
            
            // 使用密码生成密钥
            const passwordBuffer = encoder.encode(password);
            const keyBuffer = await crypto.subtle.digest('SHA-256', passwordBuffer);
            
            // 简单 XOR 加密（仅示例，实际应用需要更安全的加密）
            const encryptedBuffer = new Uint8Array(dataBuffer.length);
            const keyArray = new Uint8Array(keyBuffer);
            
            for (let i = 0; i < dataBuffer.length; i++) {
                encryptedBuffer[i] = dataBuffer[i] ^ keyArray[i % keyArray.length];
            }
            
            // 转换为 base64
            let binary = '';
            encryptedBuffer.forEach(byte => {
                binary += String.fromCharCode(byte);
            });
            
            return {
                encrypted: true,
                data: btoa(binary),
                version: '1.0'
            };
        } catch (error) {
            console.error('加密失败:', error);
            return data;
        }
    }

    // 解密数据
    async decryptData(encryptedData, password) {
        if (!encryptedData.encrypted) return encryptedData;
        if (!password) throw new Error('需要密码解密数据');
        
        try {
            // 解码 base64
            const binary = atob(encryptedData.data);
            const encryptedBuffer = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
                encryptedBuffer[i] = binary.charCodeAt(i);
            }
            
            // 使用密码生成密钥
            const encoder = new TextEncoder();
            const passwordBuffer = encoder.encode(password);
            const keyBuffer = await crypto.subtle.digest('SHA-256', passwordBuffer);
            
            // 解密
            const decryptedBuffer = new Uint8Array(encryptedBuffer.length);
            const keyArray = new Uint8Array(keyBuffer);
            
            for (let i = 0; i < encryptedBuffer.length; i++) {
                decryptedBuffer[i] = encryptedBuffer[i] ^ keyArray[i % keyArray.length];
            }
            
            // 转换为文本
            const decoder = new TextDecoder();
            const text = decoder.decode(decryptedBuffer);
            
            return JSON.parse(text);
        } catch (error) {
            console.error('解密失败:', error);
            throw new Error('解密失败，请检查密码是否正确');
        }
    }

    // 查找现有的 Gist
    async findExistingGist() {
        try {
            const response = await fetch(`${this.baseURL}/gists`, {
                headers: this.headers
            });
            
            if (!response.ok) {
                throw new Error(`查找 Gist 失败: ${response.status}`);
            }
            
            const gists = await response.json();
            const fitnessGist = gists.find(gist => 
                Object.keys(gist.files).some(filename => 
                    filename.includes('fitness-tracker')
                )
            );
            
            if (fitnessGist) {
                this.gistId = fitnessGist.id;
                return fitnessGist;
            }
            
            return null;
        } catch (error) {
            console.error('查找 Gist 失败:', error);
            throw error;
        }
    }

    // 创建新的 Gist
    async createGist(data, password) {
        try {
            // 加密数据
            const encryptedData = await this.encryptData(data, password);
            
            const gistData = {
                description: 'Fitness Tracker Data',
                public: false,
                files: {
                    [this.gistFilename]: {
                        content: JSON.stringify(encryptedData, null, 2)
                    }
                }
            };
            
            const response = await fetch(`${this.baseURL}/gists`, {
                method: 'POST',
                headers: this.headers,
                body: JSON.stringify(gistData)
            });
            
            if (!response.ok) {
                throw new Error(`创建 Gist 失败: ${response.status}`);
            }
            
            const result = await response.json();
            this.gistId = result.id;
            
            return result;
        } catch (error) {
            console.error('创建 Gist 失败:', error);
            throw error;
        }
    }

    // 更新 Gist
    async updateGist(data, password) {
        if (!this.gistId) {
            return this.createGist(data, password);
        }
        
        try {
            // 加密数据
            const encryptedData = await this.encryptData(data, password);
            
            const gistData = {
                description: 'Fitness Tracker Data - 更新于 ' + new Date().toLocaleString(),
                files: {
                    [this.gistFilename]: {
                        content: JSON.stringify(encryptedData, null, 2)
                    }
                }
            };
            
            const response = await fetch(`${this.baseURL}/gists/${this.gistId}`, {
                method: 'PATCH',
                headers: this.headers,
                body: JSON.stringify(gistData)
            });
            
            if (!response.ok) {
                throw new Error(`更新 Gist 失败: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('更新 Gist 失败:', error);
            throw error;
        }
    }

    // 获取 Gist 数据
    async getGistData(password) {
        if (!this.gistId) {
            const existingGist = await this.findExistingGist();
            if (!existingGist) {
                return null;
            }
        }
        
        try {
            const response = await fetch(`${this.baseURL}/gists/${this.gistId}`, {
                headers: this.headers
            });
            
            if (!response.ok) {
                if (response.status === 404) {
                    // Gist 不存在，清除 ID
                    this.gistId = null;
                    return null;
                }
                throw new Error(`获取 Gist 失败: ${response.status}`);
            }
            
            const gist = await response.json();
            const fileContent = gist.files[this.gistFilename]?.content;
            
            if (!fileContent) {
                throw new Error('Gist 中找不到数据文件');
            }
            
            const encryptedData = JSON.parse(fileContent);
            
            // 解密数据
            if (encryptedData.encrypted && !password) {
                throw new Error('数据已加密，需要密码解密');
            }
            
            const decryptedData = await this.decryptData(encryptedData, password);
            
            return {
                data: decryptedData,
                gistInfo: gist
            };
        } catch (error) {
            console.error('获取 Gist 数据失败:', error);
            throw error;
        }
    }

    // 同步数据到 GitHub
    async sync(data, token, password) {
        this.setToken(token);
        
        try {
            // 查找现有 Gist
            if (!this.gistId) {
                const existingGist = await this.findExistingGist();
                if (existingGist) {
                    this.gistId = existingGist.id;
                }
            }
            
            // 更新或创建 Gist
            const result = await this.updateGist(data, password);
            
            return {
                success: true,
                gistId: result.id,
                url: result.html_url,
                updatedAt: result.updated_at
            };
        } catch (error) {
            console.error('同步失败:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // 从 GitHub 拉取数据
    async pull(token, password) {
        this.setToken(token);
        
        try {
            // 查找现有 Gist
            const existingGist = await this.findExistingGist();
            if (!existingGist) {
                return {
                    success: false,
                    error: '未找到现有的健身数据 Gist'
                };
            }
            
            this.gistId = existingGist.id;
            
            // 获取数据
            const result = await this.getGistData(password);
            
            if (!result) {
                return {
                    success: false,
                    error: '获取数据失败'
                };
            }
            
            return {
                success: true,
                data: result.data,
                gistInfo: result.gistInfo
            };
        } catch (error) {
            console.error('拉取数据失败:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // 测试连接
    async testConnection(token) {
        this.setToken(token);
        
        try {
            const response = await fetch(`${this.baseURL}/user`, {
                headers: this.headers
            });
            
            if (!response.ok) {
                throw new Error(`连接失败: ${response.status}`);
            }
            
            const user = await response.json();
            
            // 检查 gist 权限
            const scopes = response.headers.get('X-OAuth-Scopes') || '';
            if (!scopes.includes('gist')) {
                throw new Error('Token 缺少 gist 权限');
            }
            
            return {
                success: true,
                username: user.login,
                scopes: scopes
            };
        } catch (error) {
            console.error('测试连接失败:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

// 导出为全局对象
window.GitHubSync = GitHubSync;