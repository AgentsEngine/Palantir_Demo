from __future__ import annotations

import os
import textwrap
from datetime import datetime
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


DESKTOP = Path(os.environ["USERPROFILE"]) / "Desktop"
OUT = DESKTOP / "PUR-SQE-2026-0527_procurement_supplier_risk_review.pdf"

W, H = 1240, 1754
M = 92
BLUE = "#155163"
LIGHT = "#EAF3F6"
BORDER = "#B9C9D0"
TEXT = "#1F2B31"
MUTED = "#6E7D84"
RED = "#B92E2A"
YELLOW = "#C98512"
WHITE = "#FFFFFF"


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    candidates = [
        "C:/Windows/Fonts/NotoSansSC-Bold.ttf" if bold else "C:/Windows/Fonts/NotoSansSC-Regular.ttf",
        "C:/Windows/Fonts/msyhbd.ttc" if bold else "C:/Windows/Fonts/msyh.ttc",
        "C:/Windows/Fonts/simhei.ttf",
    ]
    for path in candidates:
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


F = {
    "brand": font(26, True),
    "title": font(34, True),
    "h2": font(24, True),
    "body": font(21),
    "small": font(17),
    "table": font(16),
    "table_bold": font(16, True),
    "badge": font(17, True),
}


def wrap_cn(text: str, width_chars: int) -> list[str]:
    lines: list[str] = []
    for para in text.split("\n"):
        if not para:
            lines.append("")
            continue
        lines.extend(textwrap.wrap(para, width=width_chars, break_long_words=True, replace_whitespace=False))
    return lines


def draw_wrapped(draw: ImageDraw.ImageDraw, text: str, x: int, y: int, max_chars: int, fill=TEXT, size="body", leading=11) -> int:
    f = F[size]
    line_h = f.size + leading
    for line in wrap_cn(text, max_chars):
        draw.text((x, y), line, font=f, fill=fill)
        y += line_h
    return y + 8


def new_page(title: str) -> tuple[Image.Image, ImageDraw.ImageDraw, int]:
    img = Image.new("RGB", (W, H), WHITE)
    draw = ImageDraw.Draw(img)
    draw.rectangle((0, 0, W, 116), fill=BLUE)
    draw.text((M, 42), "ManuFoundry 采购知识资料", font=F["brand"], fill=WHITE)
    draw.text((W - 410, 46), "Confidential / Internal Use", font=F["small"], fill="#E8F6F9")
    draw.text((M, 158), title, font=F["title"], fill=BLUE)
    return img, draw, 222


def section(draw: ImageDraw.ImageDraw, title: str, y: int) -> int:
    draw.rectangle((M, y + 2, M + 8, y + 34), fill=BLUE)
    draw.text((M + 20, y), title, font=F["h2"], fill=BLUE)
    return y + 52


def table(draw: ImageDraw.ImageDraw, x: int, y: int, widths: list[int], headers: list[str], rows: list[list[str]], row_h=62) -> int:
    total = sum(widths)
    head_h = 54
    draw.rectangle((x, y, x + total, y + head_h), fill=LIGHT, outline=BORDER, width=2)
    cx = x
    for idx, header in enumerate(headers):
        draw.line((cx, y, cx, y + head_h), fill=BORDER, width=1)
        draw.text((cx + 10, y + 15), header, font=F["table_bold"], fill=BLUE)
        cx += widths[idx]
    draw.line((x + total, y, x + total, y + head_h), fill=BORDER, width=1)
    y += head_h
    for r, row in enumerate(rows):
        fill = "#FBFDFE" if r % 2 == 0 else WHITE
        draw.rectangle((x, y, x + total, y + row_h), fill=fill, outline=BORDER, width=1)
        cx = x
        for idx, cell in enumerate(row):
            draw.line((cx, y, cx, y + row_h), fill=BORDER, width=1)
            lines = wrap_cn(cell, max(5, widths[idx] // 20))
            ty = y + 10
            for line in lines[:2]:
                draw.text((cx + 10, ty), line, font=F["table"], fill=TEXT)
                ty += 22
            cx += widths[idx]
        draw.line((x + total, y, x + total, y + row_h), fill=BORDER, width=1)
        y += row_h
    return y + 28


def badge(draw: ImageDraw.ImageDraw, x: int, y: int, label: str, color: str) -> None:
    draw.rounded_rectangle((x, y, x + 158, y + 42), radius=4, fill=color)
    bbox = draw.textbbox((0, 0), label, font=F["badge"])
    draw.text((x + (158 - (bbox[2] - bbox[0])) / 2, y + 10), label, font=F["badge"], fill=WHITE)


def footer(draw: ImageDraw.ImageDraw, page: int) -> None:
    draw.line((M, H - 86, W - M, H - 86), fill=BORDER, width=1)
    draw.text((M, H - 52), f"Document: PUR-SQE-2026-0527    Generated: {datetime.now():%Y-%m-%d %H:%M}", font=F["small"], fill=MUTED)
    draw.text((W - 150, H - 52), f"Page {page}", font=F["small"], fill=MUTED)


def build_pages() -> list[Image.Image]:
    pages: list[Image.Image] = []

    img, d, y = new_page("采购与供应商来料风险评审报告")
    y = draw_wrapped(
        d,
        "文件编号：PUR-SQE-2026-0527\n适用范围：电子材料采购、来料检验、供应商 8D、采购交付风险沟通\n"
        "关联业务线：SMT-03 回流焊 / 锡膏 S12 / 客户订单 SO-8821 / 质量事件 QE-20260521-001",
        M,
        y,
        48,
    )
    y = section(d, "1. 背景与目标", y + 8)
    y = draw_wrapped(
        d,
        "2026-05-21，SMT-03 产线发生 BGA 焊点虚焊率升高，质量团队在复核中发现锡膏批次 MB-7781 存在运输温控记录缺口。采购部需要联合 SQE、仓储、质量与生产计划，确认供应商批次风险、采购订单影响范围、替代物料可用性和对客户交付的影响。\n"
        "本资料用于知识库入库测试：它包含采购台账、供应商绩效、来料风险处置、对象绑定线索和可发布到知识图谱的关系证据。",
        M,
        y,
        47,
    )
    y = section(d, "2. 采购订单与来料批次台账", y + 8)
    y = table(
        d,
        M,
        y,
        [170, 180, 220, 100, 140, 245, 80],
        ["采购单", "供应商", "物料/批次", "数量", "到货时间", "检验结论", "风险"],
        [
            ["PO-260519-014", "北辰电子材料", "锡膏 S12 / MB-7781", "48 kg", "05-19 08:42", "冷链记录缺失 47 分钟", "高"],
            ["PO-260520-022", "北辰电子材料", "锡膏 S12 / MB-7782", "36 kg", "05-20 09:15", "记录完整，抽检合格", "低"],
            ["PO-260521-031", "华东焊材", "锡膏 S18 / MB-7790", "24 kg", "05-22 09:10", "开封后使用时长超 8h", "中"],
            ["PO-260520-018", "安特化学", "助焊剂 F8 / FL-2431", "120 L", "05-20 11:20", "供应商等级下调", "中"],
            ["PO-260521-041", "科源电子", "BGA 芯片 / CN-9012", "8,000 pcs", "05-21 13:30", "MSL 标签缺失", "中"],
        ],
    )
    y = section(d, "3. 风险等级判定", y)
    y = draw_wrapped(d, "MB-7781 被判定为高风险批次：冻结未投产库存，追溯已投产工单，并暂停使用同供应商同批次在途物料。", M, y, 48)
    badge(d, M, y + 6, "高风险", RED)
    badge(d, M + 180, y + 6, "需 8D", YELLOW)
    badge(d, M + 360, y + 6, "冻结批次", BLUE)
    footer(d, 1)
    pages.append(img)

    img, d, y = new_page("供应商绩效与采购处置")
    y = section(d, "4. 供应商绩效复盘", y)
    y = table(
        d,
        M,
        y,
        [175, 115, 135, 145, 260, 305],
        ["供应商", "准交率", "来料合格率", "证据完整率", "本月异常", "采购策略"],
        [
            ["北辰电子材料", "91.2%", "96.8%", "78.0%", "冷链记录缺口 / 8D 未关", "限制放量，批批复核"],
            ["华东焊材", "94.6%", "98.2%", "91.5%", "回温记录不完整", "保留观察"],
            ["安特化学", "88.5%", "97.4%", "85.0%", "等级下调，COA 滞后", "提升抽检比例至 30%"],
            ["科源电子", "96.4%", "99.1%", "89.2%", "MSL 标签缺失", "要求标签复核"],
        ],
        row_h=70,
    )
    y = section(d, "5. 采购与 SQE 联合处置动作", y)
    y = table(
        d,
        M,
        y,
        [95, 440, 145, 120, 335],
        ["编号", "动作", "责任人", "截止", "验收标准"],
        [
            ["A-001", "向北辰电子材料索取 MB-7781 原始运输温度曲线", "SQE-刘洋", "05-22", "曲线覆盖发运至入库全程"],
            ["A-002", "锁定 MB-7781 剩余库存并暂停领用", "仓储-冯宇", "05-22", "ERP 库存状态为 HOLD-QA"],
            ["A-003", "确认替代批次 MB-7782 / MB-7783 可用数量", "采购-陈敏", "05-23", "满足 SO-8821 替代交付需求"],
            ["A-004", "供应商出库扫码与温控记录器绑定改造", "北辰材料", "06-01", "100% 批次可追溯"],
            ["A-005", "更新采购准入评分规则：证据完整率低于 90% 自动预警", "采购经理", "06-05", "规则上线并触发月度评审"],
        ],
        row_h=74,
    )
    y = section(d, "6. 对生产与交付的影响", y)
    draw_wrapped(
        d,
        "受影响工单：WO-260521-017、WO-260521-021。受影响客户订单：SO-8821。采购部不得在质量放行前承诺恢复交期；若替代批次通过首件 X-Ray 与回流焊温区复核，可优先分配给 SO-8821。",
        M,
        y,
        48,
    )
    footer(d, 2)
    pages.append(img)

    img, d, y = new_page("知识库入库与图谱绑定线索")
    y = section(d, "7. 建议绑定对象", y)
    y = table(
        d,
        M,
        y,
        [185, 205, 250, 220, 275],
        ["对象类型", "对象编号", "对象名称", "绑定来源", "建议状态"],
        [
            ["Supplier", "SUP-BEICHEN", "北辰电子材料", "供应商主数据", "待采购确认"],
            ["MaterialBatch", "MB-7781", "锡膏 S12 批次", "来料批次台账", "待 SQE 确认"],
            ["PurchaseOrder", "PO-260519-014", "MB-7781 采购单", "ERP 采购订单", "已匹配"],
            ["WorkOrder", "WO-260521-017", "电控模块工单", "MES 工单", "已匹配"],
            ["CustomerOrder", "SO-8821", "客户订单", "销售订单", "已匹配"],
            ["QualityEvent", "QE-20260521-001", "AOI 焊点虚焊异常", "质量事件", "已匹配"],
        ],
        row_h=64,
    )
    y = section(d, "8. 可发布图谱关系", y)
    y = table(
        d,
        M,
        y,
        [270, 180, 300, 385],
        ["起点", "关系", "终点", "证据位置"],
        [
            ["北辰电子材料", "SUPPLIES", "MB-7781 锡膏 S12", "第 2 节采购台账"],
            ["PO-260519-014", "CONTAINS_BATCH", "MB-7781 锡膏 S12", "第 2 节采购台账"],
            ["MB-7781 锡膏 S12", "MAY_CAUSE", "BGA 焊点虚焊", "第 3 节风险等级"],
            ["MB-7781 锡膏 S12", "AFFECTS", "WO-260521-017", "第 6 节影响范围"],
            ["WO-260521-017", "AFFECTS_ORDER", "SO-8821 客户订单", "第 6 节影响范围"],
        ],
        row_h=64,
    )
    y = section(d, "9. 入库建议", y)
    draw_wrapped(
        d,
        "建议权限范围：enterprise。建议 owner：SQE-刘洋 / 采购-陈敏。建议审核路径：AI 初步识别对象与关系 -> SQE 校验批次和供应商证据 -> 采购经理确认采购策略 -> 图谱管理员发布正式关系。",
        M,
        y,
        48,
    )
    footer(d, 3)
    pages.append(img)

    return pages


def main() -> None:
    pages = build_pages()
    pages[0].save(OUT, "PDF", resolution=150.0, save_all=True, append_images=pages[1:])
    print(str(OUT))


if __name__ == "__main__":
    main()
