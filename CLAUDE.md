# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

这是一个使用 Hugo 静态网站生成器构建的个人博客项目。博客使用 GitHub Pages 进行托管，Twikoo 作为评论系统。

- **主站地址**: https://blog.riba2534.cn
- **主题**: hugo-theme-diary (自定义分支: https://github.com/riba2534/hugo-theme-diary)
- **评论系统**: Twikoo (https://twikoo.riba2534.cn)

## 常用命令

### 本地开发
```bash
# 初始化子模块（第一次克隆后需要执行）
git submodule init
git submodule update

# 更新主题到最新版本
git submodule update --remote --merge

# 启动本地开发服务器
hugo server --disableFastRender

# 使用 Makefile 启动服务器（绑定到局域网 IP）
make server
```

### 构建
```bash
# 构建静态网站（输出到 public 目录）
hugo --minify

# 构建用于生产环境
HUGO_ENVIRONMENT=production hugo --minify
```

## 项目结构

### 核心配置
- `config.toml`: Hugo 配置文件，包含站点基本信息、菜单配置、评论系统配置等
- `.github/workflows/deploy.yml`: GitHub Actions 自动部署配置，当推送到 main 分支时自动构建并部署到 GitHub Pages

### 内容组织
- `content/`: 所有内容文件
  - `content/blog/`: 博客文章，按年份组织（如 2021/, 2022/, 2024/）
  - `content/about.md`: 关于页面
  - `content/friends.md`: 友链页面
  - `content/archive.md`: 归档页面

### 主题配置
- 主题作为 Git 子模块存储在 `themes/diary/`
- 使用自定义的 hugo-theme-diary 分支
- 主题支持数学公式（MathJax）、代码高亮、评论系统等功能

## 重要特性

1. **评论系统**: 使用 Twikoo，配置在 config.toml 中的 `twikooEnvId`
2. **代码高亮**: 使用 onedark 主题，支持行号显示
3. **数学公式**: 启用了 MathJax 和 LaTeX 支持
4. **自动部署**: 推送到 main 分支后，GitHub Actions 会自动构建并部署到 GitHub Pages
5. **扩展版 Hugo**: 项目需要 Hugo 扩展版（extended）以支持 SASS/SCSS 编译

## 注意事项

- Hugo 版本需要使用扩展版（extended），以支持主题中的 SASS/SCSS
- 所有新文章应放在 `content/blog/` 目录下，按年份组织
- 主题是通过 Git 子模块管理的，修改主题需要在子模块仓库中进行
- 部署是通过 GitHub Actions 自动完成的，无需手动构建和推送