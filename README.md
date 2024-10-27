# riba2534's Blog

我的博客，使用 hugo+github pages 部署，gittalk 作为评论系统.

20241027 更新到最新版本，主题采用自己仓库的 [hugo-theme-diary](https://github.com/riba2534/hugo-theme-diary)

地址为：https://blog.riba2534.cn


# 构建方法

```bash

# 初始化本地配置文件
git submodule init
# 拉数据
git submodule update

# 拉取最新数据
git submodule update --remote --merge

# 启动服务器
hugo server
```

