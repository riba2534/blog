---
title: "用 Tailscale 组建自己的虚拟局域网"
date: 2026-02-27T04:44:58+08:00
draft: true
featured_image: ""
description: "在 OrbStack 虚拟机和云服务器上部署 Tailscale，实现异地设备互联、子网路由和出口节点配置的完整实践记录"
tags:
- Tailscale
- 网络
- OrbStack
- WireGuard
categories:
- 技术教程
comment: true
---

# 用 Tailscale 组建自己的虚拟局域网

## 背景

我手上有好几台设备散落在不同的网络里：家里有一台 Mac mini M4 跑着各种服务，公网有一台腾讯云轻量服务器和一台搬瓦工 VPS，再加上日常用的 MacBook Pro 和 iPhone。一直想把它们组成一个虚拟局域网，不管在哪里都能互相访问，就像在同一个路由器下面一样。

之前在 Mac mini 的 OrbStack 虚拟机里装过一次 Tailscale，用了一阵子，DNS 解析经常出问题，Tailscale 的健康检查一直报错：

```
# Health check:
#     - Tailscale failed to fetch the DNS configuration of your device: exit status 1
#     - Tailscale can't reach the configured DNS servers.
```

管理后台的出口节点也一直显示 "Unable to relay traffic"、"IP forwarding disabled"。虽然实际检查 `sysctl` 发现 IP 转发是开着的，但总感觉哪里配得不对。折腾了一圈之后，我决定推倒重来——删掉旧虚拟机，从零开始配一遍，顺便把整个过程和原理都记录下来。

## Tailscale 和 WireGuard 的关系

要理解 Tailscale，先得知道 WireGuard。

[WireGuard](https://www.wireguard.com/) 是一个现代的 VPN 协议，2020 年进入 Linux 5.6 内核主线。它的代码只有大约 4000 行（对比 OpenVPN 的 10 万行），设计极其简洁。性能上，WireGuard 跑在内核态，吞吐量和延迟都显著优于 OpenVPN 和 IPsec。

但 WireGuard 有个问题：**它只是一个协议，不是一个完整的解决方案**。你需要自己管理密钥分发（每台设备的公钥要手动分发到所有其他设备）、自己处理 NAT 穿透（两台 NAT 后面的设备怎么互联？）、自己维护配置文件。设备一多，维护成本就很高。

Tailscale 就是在 WireGuard 上面做了一层"管理层"。它的架构是这样的：

```
┌─────────────┐      ┌──────────────────┐      ┌─────────────┐
│   设备 A     │      │  Tailscale 协调   │      │   设备 B     │
│  tailscaled  │◄────►│  服务器           │◄────►│  tailscaled  │
│  (WireGuard) │      │  (密钥分发/NAT)   │      │  (WireGuard) │
└──────┬───────┘      └──────────────────┘      └──────┬───────┘
       │                                                │
       └──────── WireGuard 加密隧道（直连）──────────────┘
```

协调服务器只负责交换密钥和地址信息，**实际数据不经过 Tailscale 的服务器**。设备之间通过 WireGuard 直连通信，端到端加密。

每台设备加入网络后会分配一个 `100.x.x.x` 段的虚拟 IP（Tailscale 称之为 CGNAT 地址），这个 IP 绑定设备，不随物理网络变化。你在家里、在公司、用手机热点、甚至在国外，IP 都是同一个。

## 我的网络拓扑

先看看我最终搭建完成的网络拓扑：

```
                        ┌──────────────────────┐
                        │  Tailscale Network   │
                        │   (100.x.x.x/32)    │
                        └──────────┬───────────┘
                                   │
          ┌────────────────────────┼────────────────────────┐
          │                        │                        │
    ┌─────┴──────┐          ┌──────┴──────┐          ┌──────┴──────┐
    │ Mac mini   │          │  腾讯云      │          │  搬瓦工     │
    │ (OrbStack) │          │ tenxuncloud  │          │    bwh      │
    │            │          │ -cn          │          │             │
    │ 100.90.    │          │ 100.100.     │          │ 100.107.    │
    │ 253.33     │          │ 164.32       │          │ 230.33      │
    │            │          │              │          │             │
    │ ✓ 子网路由  │          │              │          │ ✓ 出口节点  │
    │ ✓ 出口节点  │          │              │          │             │
    └─────┬──────┘          └──────────────┘          └─────────────┘
          │
          │ 192.168.31.0/24
    ┌─────┴──────┐
    │ 家庭局域网  │
    │  路由器     │
    │  NAS       │
    │  其他设备   │
    └────────────┘
```

三个关键角色：

- **tailscale-node**（Mac mini 上的 OrbStack 虚拟机）：既是出口节点，又广播家庭局域网 `192.168.31.0/24` 的子网路由
- **bwh**（搬瓦工 VPS，日本机房）：出口节点，用于海外网络访问
- **tenxuncloud-cn**（腾讯云轻量服务器）：普通节点，国内业务

iPhone 和 MacBook Pro 作为客户端，可以随时切换不同的出口节点。

---

## 第一步：创建 OrbStack 虚拟机

我的 Mac mini 跑的是 macOS，用 [OrbStack](https://orbstack.dev/) 管理 Linux 虚拟机。OrbStack 比 Docker Desktop 轻量得多，启动一个 Linux VM 只需要几秒。

先把之前有问题的旧虚拟机删掉：

```bash
# 先让旧虚拟机的 Tailscale 登出，避免在管理后台留下僵尸节点
orb -m ubuntu -u root tailscale logout

# 停止并删除
orbctl stop ubuntu
orbctl delete ubuntu
```

创建一台新的 Ubuntu 24.04 虚拟机：

```bash
orbctl create ubuntu:noble tailscale-node
```

创建完后确认状态：

```bash
$ orbctl list
tailscale-node  running  ubuntu  noble  arm64  852.7 MB  192.168.139.88
```

OrbStack 的虚拟机可以直接通过 `orb -m tailscale-node` 或者 `ssh riba2534@tailscale-node.orb` 访问，非常方便。

## 第二步：配置内核参数

在安装 Tailscale 之前，有两件事必须先做。

### 开启 IP 转发

如果你打算用这台机器做子网路由（把局域网暴露给 Tailscale 网络）或出口节点（让其他设备通过它上网），**必须先开启 IP 转发**。Linux 默认不会转发不属于自己的网络包——收到目标 IP 不是本机的包，直接丢弃。开启 IP 转发后，内核才会把这些包按路由表转发出去。

```bash
# 创建 sysctl 配置文件（重启后依然生效）
cat > /etc/sysctl.d/99-tailscale.conf << EOF
net.ipv4.ip_forward = 1
net.ipv6.conf.all.forwarding = 1
EOF

# 立即加载配置
sysctl -p /etc/sysctl.d/99-tailscale.conf
```

输出：

```
net.ipv4.ip_forward = 1
net.ipv6.conf.all.forwarding = 1
```

验证一下：

```bash
$ sysctl net.ipv4.ip_forward net.ipv6.conf.all.forwarding
net.ipv4.ip_forward = 1
net.ipv6.conf.all.forwarding = 1
```

这里有个坑需要注意：写到 `/etc/sysctl.conf` 和 `/etc/sysctl.d/99-tailscale.conf` 都可以，但推荐用 `.d` 目录下的独立文件，这样更清晰，以后删除 Tailscale 的时候直接删掉这个文件就行，不需要从一个大配置文件里找来找去。

### 优化 UDP GRO 转发

Tailscale 底层是 WireGuard，WireGuard 走的是 UDP 协议。Linux 内核默认的 UDP GRO（Generic Receive Offload）配置对转发场景不是最优的。Tailscale 官方建议调整 ethtool 参数：

```bash
# 立即生效
ethtool -K eth0 rx-udp-gro-forwarding on rx-gro-list off
```

如果不改这个配置，`tailscale up` 的时候会看到一条警告：

```
Warning: UDP GRO forwarding is suboptimally configured on eth0,
UDP forwarding throughput capability will increase with a configuration change.
See https://tailscale.com/s/ethtool-config-udp-gro
```

功能不受影响，但转发吞吐量会打折扣。

ethtool 的问题是它不持久化，重启就丢。用 networkd-dispatcher 的钩子脚本解决：

```bash
cat > /etc/networkd-dispatcher/routable.d/50-tailscale << 'SCRIPT'
#!/bin/sh
ethtool -K eth0 rx-udp-gro-forwarding on rx-gro-list off 2>/dev/null
SCRIPT
chmod +x /etc/networkd-dispatcher/routable.d/50-tailscale
```

这样每次网卡进入 routable 状态时（包括开机），都会自动执行这行配置。

## 第三步：安装 Tailscale

内核参数搞定后，安装 Tailscale 本身很简单，官方提供了一键脚本：

```bash
curl -fsSL https://tailscale.com/install.sh | sh
```

脚本会自动检测你的发行版和版本，添加 apt 源，安装 `tailscale` 和 `tailscale-archive-keyring` 两个包。安装完的输出：

```
Installation complete! Log in to start using Tailscale by running:
tailscale up
```

安装过程中，脚本会自动：
- 创建 systemd 服务 `tailscaled.service`
- 设置为开机自启（`systemctl enable tailscaled`）
- 启动守护进程

可以确认一下：

```bash
$ systemctl show tailscaled | grep -E "^Restart=|^UnitFileState="
Restart=on-failure
UnitFileState=enabled
```

`Restart=on-failure` 意味着 tailscaled 进程异常退出后会自动重启，`enabled` 意味着开机自启。安装完就是生产级别的可靠性，不需要额外配置 supervisor 或 crontab。

## 第四步：启动并声明网络能力

安装完之后，用 `tailscale up` 启动并声明这台机器的网络能力：

```bash
tailscale up --advertise-exit-node --advertise-routes=192.168.31.0/24
```

两个关键参数：

- `--advertise-exit-node`：告诉 Tailscale 网络"我可以当出口节点"，其他设备可以选择通过我上网
- `--advertise-routes=192.168.31.0/24`：告诉 Tailscale 网络"我能到达 192.168.31.0/24 这个子网"，其他设备访问这个网段时流量会转发给我

执行后会输出一个认证链接：

```
To authenticate, visit:
    https://login.tailscale.com/a/145ef439013482
```

在浏览器里打开这个链接，用你的 Tailscale 账号登录，设备就加入网络了。输出 `Success.` 表示认证成功。

### 后续配置

认证通过后，还有几个重要的设置需要开启：

```bash
# 开启自动更新（自动下载并安装新版本）
tailscale set --auto-update

# 接受其他节点广播的子网路由
tailscale set --accept-routes

# 设置操作员（非 root 用户也能执行 tailscale 命令）
tailscale set --operator=riba2534
```

其中 `--accept-routes` 容易遗漏。如果你不开这个，即使别的节点广播了子网路由，你这台机器也不会识别。我在搬瓦工上 `ping 192.168.31.66` 一直不通，排查了半天才发现是 `--accept-routes` 没开。

验证所有配置是否生效：

```bash
$ tailscale debug prefs | grep -E "AutoUpdate|AcceptRoutes|AdvertiseRoutes"
    "AdvertiseRoutes": [
    "AutoUpdate": {
        "Check": true,
        "Apply": true
```

`Check: true` 表示会定期检查更新，`Apply: true` 表示检查到新版本后自动安装。

查看当前网络中所有设备的状态：

```bash
$ tailscale status
100.90.253.33   tailscale-node  riba2534.me@  linux  -
100.96.124.36   hpcmacbook-pro  riba2534.me@  macOS  offline, last seen 25d ago
100.103.53.52   iphone182       riba2534.me@  iOS    offline, last seen 3d ago
100.100.164.32  tenxuncloud-cn  riba2534.me@  linux  active; direct 82.157.188.40:41641
```

可以看到每台设备的 Tailscale IP、设备名、操作系统、在线状态，还有连接方式（direct 表示直连，DERP 表示中继）。

---

## 在云服务器上部署

云服务器的部署流程和虚拟机基本一样，但会更简单一些——公网服务器有固定 IP，不需要处理 NAT 穿透，对端设备可以直接连上来。

以我的搬瓦工 VPS（日本机房，Ubuntu 24.04）为例，完整的命令序列：

```bash
# 安装 Tailscale
curl -fsSL https://tailscale.com/install.sh | sh

# 启动（这里只声明为出口节点，不需要子网路由）
tailscale up --advertise-exit-node
# → 打开链接登录认证

# 开启 IP 转发
cat > /etc/sysctl.d/99-tailscale.conf << EOF
net.ipv4.ip_forward = 1
net.ipv6.conf.all.forwarding = 1
EOF
sysctl -p /etc/sysctl.d/99-tailscale.conf

# 自动更新 + 接受路由
tailscale set --auto-update
tailscale set --accept-routes

# 改个好记的名字（默认是系统 hostname，往往很长不好记）
tailscale set --hostname=bwh
```

改完 hostname 后，在 Tailscale 网络里可以直接用 `bwh` 作为域名访问这台机器，完整域名是 `bwh.tail8bca6e.ts.net`。

---

## Tailscale 管理后台配置

到这里，命令行的工作就完成了。但有个重要的事情：**命令行只是"声明"了能力，真正生效还需要在 Tailscale 管理后台里批准。**

这个设计是出于安全考虑——任何一台设备声称自己是出口节点或者能到达某个子网，管理员（也就是你）必须明确同意才能生效。

打开 [Tailscale Admin Console](https://login.tailscale.com/admin/machines)，对每台节点需要确认三件事：

### 批准子网路由

找到 `tailscale-node`，点击 "Edit route settings"，可以看到 `192.168.31.0/24` 显示为 "Awaiting Approval"。点击 Review → Approve 批准它。

批准后，网络中所有开启了 `--accept-routes` 的设备就能通过 `tailscale-node` 访问 `192.168.31.x` 网段了。

### 批准出口节点

同样在 "Edit route settings" 里，Exit Node 显示为 "Awaiting approval"。点击 Edit → 设为 Allowed。对 `bwh` 也做同样的操作。

### 禁用 Key 过期

Tailscale 默认会给每台设备的密钥设置过期时间（通常 180 天）。密钥过期后设备会断开连接，需要重新认证。对于服务器类设备，这很不方便——你不想半年后突然发现 SSH 不上去了。

在每台设备的页面上，找到 "Key expiry"，点击 "Disable key expiry" 禁用它。管理后台会显示 "No expiry"。

---

## 使用出口节点

配置完成后，网络里有了两个出口节点。出口节点的作用是让某台设备的**所有出站流量**都通过指定节点转发出去，相当于"全局代理"。

我的两个出口：

- `tailscale-node`：Mac mini 虚拟机，走家里的宽带，国内网络
- `bwh`：搬瓦工 VPS 日本机房，走海外网络

在任何设备上切换出口只需要一条命令：

```bash
# 通过 bwh（海外）上网
tailscale set --exit-node=bwh

# 切到 tailscale-node（国内）
tailscale set --exit-node=tailscale-node

# 关闭出口节点，恢复正常上网
tailscale set --exit-node=
```

iPhone 和 Mac 上的 Tailscale App 也可以在 UI 里切换，不需要命令行。

这里有两个容易搞混的点：

**出口节点是按设备生效的，不是全局的。** 你在腾讯云上执行 `tailscale set --exit-node=bwh`，只有腾讯云的流量走 bwh。你的 MacBook、iPhone、Mac mini 都不受影响。每台设备需要各自设置。

**一旦设了 exit node，那台设备的所有出站流量都走出口节点。** 包括 apt 更新、curl 请求、DNS 查询，全走。如果你只想让 Tailscale 内网流量走隧道、其他流量还走自己的网络，就不要设 exit node。Tailscale 的内网互通（100.x.x.x 之间）不需要出口节点，直接走 WireGuard 隧道。

多个出口节点之间也不会冲突。它们只是"可选项"，等着客户端来选。

---

## 子网路由详解

子网路由是 Tailscale 最实用的功能之一。我在 `tailscale-node` 上声明了 `--advertise-routes=192.168.31.0/24`，这意味着：**整个 Tailscale 网络中的设备，都可以通过 tailscale-node 访问我家里 192.168.31.x 网段的所有设备**。

这解决了一个真实的需求——家里有些设备不可能装 Tailscale（路由器管理页面、NAS Web UI、智能家居设备），但通过子网路由，我在外面也能直接访问它们。

比如在搬瓦工上 `ping 192.168.31.66`（家里的一台设备），流量路径：

```
bwh (100.107.230.33)
  → WireGuard 隧道
    → tailscale-node (100.90.253.33)
      → 家庭局域网 192.168.31.0/24
        → 192.168.31.66
```

实际测试：

```bash
$ ping -c 3 192.168.31.66
PING 192.168.31.66 (192.168.31.66) 56(84) bytes of data.
64 bytes from 192.168.31.66: icmp_seq=1 ttl=62 time=933 ms
64 bytes from 192.168.31.66: icmp_seq=2 ttl=62 time=62.4 ms
64 bytes from 192.168.31.66: icmp_seq=3 ttl=62 time=62.6 ms
```

第一个包 933ms 是因为 WireGuard 隧道还没建立（走了 DERP 中继），后面两个包 62ms 是直连后的延迟。从日本到北京的家里，62ms 其实相当不错了。

**前提条件**：对方节点必须开启 `--accept-routes`。我之前搬瓦工 ping 192.168.31.x 一直不通，排查了半天以为是防火墙的问题，最后发现就是 `--accept-routes` 没开。这应该是最常见的踩坑点了。

---

## NAT 打洞原理

Tailscale 最核心的技术之一就是 NAT 打洞（NAT Traversal）。它让两台都在 NAT 后面的设备能够直连通信，不需要中转服务器。

### 为什么需要打洞？

家用宽带和移动网络几乎都在 NAT 后面。你的设备拿到的是一个内网 IP（比如 `192.168.31.100`），对外通信时，路由器会把源地址替换成公网 IP（比如 `123.120.8.213:随机端口`）。外部设备直接往这个公网 IP 发包是收不到的——路由器的 NAT 表里没有这条映射记录，包会被丢弃。

两台都在 NAT 后面的设备想直接通信，就必须"打洞"——让双方的 NAT 表都建立起允许对方流量通过的映射。

### 三个阶段

整个过程分三步：

**阶段一：地址发现。** 两个节点各自通过 STUN（Session Traversal Utilities for NAT）协议探测自己的公网地址。STUN 的原理很简单：往一个公网上的 STUN 服务器发一个 UDP 包，服务器把"我看到你的来源地址是什么"告诉你。这样每个节点就知道自己的公网 IP 和端口了。

每个节点把自己的信息上报给 Tailscale 协调服务器（Coordination Server）：

- 所有本机网卡 IP（如 `192.168.139.88`）
- 经过 NAT 后的公网 IP:端口（如 `206.190.235.218:56481`）
- NAT 类型（是否对称型 NAT）

协调服务器把对方的地址列表下发给双方。注意，**协调服务器只传递地址信息，不中转数据**。

**阶段二：DERP 中继。** 在打洞完成之前，流量不能断。Tailscale 通过 DERP（Designated Encrypted Relay for Packets）服务器中继。DERP 本质上是加密的 TCP 转发——节点 A 把加密的 WireGuard 包发给 DERP 服务器，DERP 服务器转发给节点 B。

这就是你第一次 ping 看到 660ms 的原因——数据包从北京到 Nuremberg 的 DERP 服务器，再到日本的搬瓦工，绕了一大圈。

Tailscale 在全球部署了 20 多个 DERP 服务器，会自动选择延迟最低的那个。用 `tailscale netcheck` 可以看到到每个 DERP 服务器的延迟：

```bash
$ tailscale netcheck
Report:
    * UDP: true
    * IPv4: yes, 206.190.235.218:33694
    * IPv6: no, but OS has support
    * MappingVariesByDestIP: false
    * Nearest DERP: Tokyo
    * DERP latency:
        - tok: 613.5ms (Tokyo)
        - hkg: 613.6ms (Hong Kong)
        - lax: 675.5ms (Los Angeles)
        ...
```

`MappingVariesByDestIP: false` 说明 NAT 类型不是对称型，打洞成功率很高。

**阶段三：打洞。** 双方同时向对方的所有候选地址发送 UDP 探测包（Disco 协议，Tailscale 自己定义的发现协议）。关键原理在这里：

当节点 A 往节点 B 的公网地址发 UDP 包时，A 这边路由器的 NAT 表会记下这条映射："内网 A:port_a → 公网 B:port_b"。当 B 的回包从 B:port_b 到达时，路由器一看 NAT 表——有这条记录，认为是"已有连接的响应"，就放行了。

B 这边也是同样的道理。双方同时发包，双方的 NAT 表同时建立映射，"洞"就打通了。

```
时间线：
  t0  双方上报地址给协调服务器
  t1  协调服务器交换地址列表
  t2  流量先走 DERP 中继（保证不断连）
  t3  双方同时发 UDP 探测包（通过 DERP 协调时机）
  t4  双方 NAT 表建立映射，直连通道打通
  t5  切换到直连，DERP 中继闲置后断开
```

实际观察这个过程，第一次 ping 走的是 DERP 中继（高延迟），几秒后自动切换到直连（低延迟）：

```bash
# 第一次 ping，走 DERP 中继
$ tailscale ping tenxuncloud-cn
pong from tenxuncloud-cn (100.100.164.32) via DERP(nue) in 665ms
pong from tenxuncloud-cn (100.100.164.32) via DERP(nue) in 759ms

# 等几秒再 ping，已经直连了
$ tailscale ping tenxuncloud-cn
pong from tenxuncloud-cn (100.100.164.32) via 82.157.188.40:41641 in 10ms
```

从 660ms 骤降到 10ms，`via 82.157.188.40:41641` 说明已经通过腾讯云的公网 IP 直连了。

### 打洞失败的情况

如果你的 NAT 是**对称型**（`MappingVariesByDestIP: true`），意味着每次往不同目标发包，NAT 映射的端口都不一样。A 往 STUN 服务器发包探测到的端口是 50000，但 A 往 B 发包时 NAT 映射的端口可能变成了 50001。B 按照 50000 去打洞自然打不通。

遇到这种情况，流量会一直走 DERP 中继。延迟会高一些，但功能不受影响。好消息是大多数家用路由器的 NAT 都不是对称型的。

如果有一方是**公网服务器**（比如我的搬瓦工），打洞基本是秒完成的——公网服务器没有 NAT，UDP 包直接就能到达，不需要双方协调。

---

## MagicDNS

Tailscale 内置了一套 DNS 服务叫 MagicDNS。开启后，你可以用设备名直接访问其他节点，不需要记 IP：

```bash
# 用设备名代替 IP
ssh root@bwh                    # 等同于 ssh root@100.107.230.33
ping tenxuncloud-cn             # 等同于 ping 100.100.164.32
curl http://tailscale-node:8080 # 访问虚拟机上的服务
```

完整域名是 `设备名.你的tailnet域名.ts.net`，比如 `bwh.tail8bca6e.ts.net`。短域名 `bwh` 在 Tailscale 网络内也能解析。

MagicDNS 启用后，设备的 `/etc/resolv.conf` 会被 Tailscale 接管，指向 `100.100.100.100`（Tailscale 的内置 DNS）：

```
nameserver 100.100.100.100
search tail8bca6e.ts.net
```

我之前旧虚拟机的 DNS 问题可能就出在这里——`100.100.100.100` 能 ping 通但 DNS 查询失败，而且那台虚拟机没有 `systemd-resolved`，DNS fallback 机制不完善。新虚拟机重新配置后一切正常，具体原因没有深究。

---

## 完整配置检查清单

整理一下每台 Linux 节点应该有的完整配置：

| 配置项 | 命令 | 说明 | 是否持久化 |
|--------|------|------|-----------|
| IPv4 转发 | `sysctl` 写入 `/etc/sysctl.d/` | 子网路由/出口节点必须 | 是（sysctl.d） |
| IPv6 转发 | 同上 | 如果需要 IPv6 支持 | 是（sysctl.d） |
| UDP GRO 优化 | `ethtool -K eth0 ...` | 提升 UDP 转发吞吐量 | 是（networkd-dispatcher） |
| 自动更新 | `tailscale set --auto-update` | 自动安装新版本并重启服务 | 是（Tailscale 记住） |
| 接受路由 | `tailscale set --accept-routes` | 识别其他节点的子网路由 | 是（Tailscale 记住） |
| 开机自启 | `systemctl enable tailscaled` | 安装脚本自动设置 | 是（systemd） |
| 进程守护 | `Restart=on-failure`（systemd 默认） | tailscaled 崩溃自动重启 | 是（systemd） |
| 禁用 Key 过期 | 管理后台操作 | 防止密钥过期断连 | 是（服务端记住） |
| 批准子网路由 | 管理后台操作 | 声明不等于生效 | 是（服务端记住） |
| 批准出口节点 | 管理后台操作 | 同上 | 是（服务端记住） |

所有配置都是持久化的。`tailscale set` 的参数存储在 `/var/lib/tailscale/tailscaled.state` 里，管理后台的配置存在 Tailscale 服务端。基本就是**配一次就不用管了**。

如果哪天需要排查问题，几个有用的诊断命令：

```bash
# 查看所有节点状态
tailscale status

# 网络连通性检查（NAT 类型、DERP 延迟）
tailscale netcheck

# 测试到某个节点的连通性（显示走 DERP 还是直连）
tailscale ping <节点名>

# 查看当前所有配置
tailscale debug prefs

# 查看 tailscaled 日志
journalctl -u tailscaled -f
```

## 参考资料

- [Tailscale 官方文档](https://tailscale.com/kb/)
- [Tailscale 子网路由配置](https://tailscale.com/kb/1019/subnets/)
- [Tailscale 出口节点配置](https://tailscale.com/kb/1103/exit-nodes/)
- [Linux IP 转发配置指南](https://tailscale.com/kb/1104/enable-ip-forwarding/)
- [WireGuard 官网](https://www.wireguard.com/)
- [How Tailscale Works](https://tailscale.com/blog/how-tailscale-works)
- [How NAT Traversal Works](https://tailscale.com/blog/how-nat-traversal-works)
