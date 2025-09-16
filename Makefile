.PHONY: help serve serve-lan build clean new preview deploy

# 默认目标：显示帮助信息
help:
	@echo "可用的命令："
	@echo "  make serve      - 启动本地开发服务器 (localhost:1313)"
	@echo "  make serve-lan  - 启动局域网可访问的服务器"
	@echo "  make build      - 构建静态网站"
	@echo "  make clean      - 清理生成的文件"
	@echo "  make new        - 创建新文章 (使用: make new title=\"文章标题\")"
	@echo "  make preview    - 构建并预览生产版本"
	@echo "  make deploy     - 部署到 GitHub Pages (需要先提交代码)"

# 启动本地开发服务器
serve:
	hugo server --disableFastRender

# 启动局域网可访问的服务器
serve-lan:
	hugo server --disableFastRender --bind 0.0.0.0

# 兼容旧命令
server: serve-lan

# 构建静态网站
build:
	hugo --minify

# 清理生成的文件
clean:
	rm -rf public resources

# 创建新文章
new:
ifndef title
	@echo "请指定文章标题，例如: make new title=\"我的新文章\""
else
	hugo new blog/$(shell date +%Y)/$(title).md
	@echo "文章已创建: content/blog/$(shell date +%Y)/$(title).md"
endif

# 构建并预览生产版本
preview:
	@echo "构建生产版本..."
	HUGO_ENVIRONMENT=production hugo --minify
	@echo "启动预览服务器..."
	cd public && python3 -m http.server 8080

# 部署到 GitHub Pages（通过 GitHub Actions）
deploy:
	@echo "确保所有更改已提交..."
	@git status
	@echo ""
	@echo "如果以上显示有未提交的更改，请先提交。"
	@echo "准备推送到 main 分支触发自动部署..."
	@read -p "确认推送? (y/n) " -n 1 -r; \
	echo ""; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		git push origin main; \
		echo "已推送，GitHub Actions 将自动部署"; \
	else \
		echo "已取消"; \
	fi