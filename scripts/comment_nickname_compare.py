import json
import os
from datetime import datetime
from urllib import request

from PIL import Image, ImageDraw, ImageFont


BASE_URL = os.environ.get("BASE_URL", "http://localhost:3000")
USER_ID = "wx_user_001"
OUTPUT_DIR = os.path.join(os.getcwd(), "outputs")


def http_json(url, method="GET", payload=None):
    data = None
    headers = {"Content-Type": "application/json"}
    if payload is not None:
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = request.Request(url=url, method=method, data=data, headers=headers)
    with request.urlopen(req, timeout=15) as resp:
        raw = resp.read().decode("utf-8")
        return json.loads(raw)


def extract_user_id(item):
    user_id = item.get("userId")
    if isinstance(user_id, dict):
        return str(user_id.get("_id", ""))
    return str(user_id)


def collect_comments_for_user(user_id, limit=50):
    resp = http_json(f"{BASE_URL}/api/admin/comments?limit={limit}&page=1")
    comments = resp.get("comments", [])
    matched = [c for c in comments if extract_user_id(c) == str(user_id)]
    return matched


def pick_font(size):
    candidates = [
        r"C:\Windows\Fonts\msyh.ttc",
        r"C:\Windows\Fonts\simhei.ttf",
        r"C:\Windows\Fonts\simsun.ttc",
    ]
    for path in candidates:
        if os.path.exists(path):
            return ImageFont.truetype(path, size=size)
    return ImageFont.load_default()


def draw_panel(title, subtitle, rows, output_path, accent):
    width, height = 1700, 950
    bg = (248, 250, 252)
    panel = Image.new("RGB", (width, height), bg)
    draw = ImageDraw.Draw(panel)
    title_font = pick_font(44)
    sub_font = pick_font(26)
    row_font = pick_font(24)

    draw.rounded_rectangle((28, 28, width - 28, height - 28), radius=24, fill=(255, 255, 255), outline=(225, 232, 240), width=2)
    draw.text((60, 60), title, fill=accent, font=title_font)
    draw.text((60, 128), subtitle, fill=(71, 85, 105), font=sub_font)
    y = 180
    draw.line((60, y, width - 60, y), fill=(226, 232, 240), width=2)
    y += 26
    draw.text((60, y), "序号", fill=(51, 65, 85), font=row_font)
    draw.text((160, y), "评论ID", fill=(51, 65, 85), font=row_font)
    draw.text((540, y), "用户名", fill=(51, 65, 85), font=row_font)
    draw.text((820, y), "内容片段", fill=(51, 65, 85), font=row_font)
    draw.text((1320, y), "时间", fill=(51, 65, 85), font=row_font)
    y += 38
    draw.line((60, y, width - 60, y), fill=(226, 232, 240), width=2)
    y += 18

    if not rows:
        draw.text((60, y), "无匹配评论数据", fill=(239, 68, 68), font=row_font)
    else:
        for idx, row in enumerate(rows[:10], start=1):
            comment_id = str(row.get("_id", ""))[:26]
            nickname = str(row.get("nickname", ""))
            content = str(row.get("content", "")).replace("\n", " ")
            content = content[:28] + ("..." if len(content) > 28 else "")
            created_at = str(row.get("createdAt", ""))[0:19].replace("T", " ")
            draw.text((60, y), str(idx), fill=(15, 23, 42), font=row_font)
            draw.text((160, y), comment_id, fill=(15, 23, 42), font=row_font)
            draw.text((540, y), nickname, fill=accent, font=row_font)
            draw.text((820, y), content, fill=(15, 23, 42), font=row_font)
            draw.text((1320, y), created_at, fill=(71, 85, 105), font=row_font)
            y += 56
            draw.line((60, y, width - 60, y), fill=(241, 245, 249), width=1)
            y += 14

    panel.save(output_path)


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    user_resp = http_json(f"{BASE_URL}/api/users/{USER_ID}")
    user = user_resp.get("user", {})
    old_name = str(user.get("nickname", "微信用户"))
    stamp = datetime.now().strftime("%H%M%S")
    new_name = f"{old_name}_实时对比{stamp}"

    before_rows = collect_comments_for_user(USER_ID, limit=50)

    http_json(f"{BASE_URL}/api/users/{USER_ID}", method="PUT", payload={"nickname": new_name})
    after_rows = collect_comments_for_user(USER_ID, limit=50)
    http_json(f"{BASE_URL}/api/users/{USER_ID}", method="PUT", payload={"nickname": old_name})

    before_img = os.path.join(OUTPUT_DIR, "comment-name-before.png")
    after_img = os.path.join(OUTPUT_DIR, "comment-name-after.png")
    data_file = os.path.join(OUTPUT_DIR, "comment-name-compare.json")

    draw_panel(
        "评论管理用户名对比（修改前）",
        f"用户ID: {USER_ID}    昵称: {old_name}",
        before_rows,
        before_img,
        accent=(37, 99, 235),
    )
    draw_panel(
        "评论管理用户名对比（修改后）",
        f"用户ID: {USER_ID}    昵称: {new_name}",
        after_rows,
        after_img,
        accent=(22, 163, 74),
    )

    payload = {
        "userId": USER_ID,
        "oldNickname": old_name,
        "temporaryNewNickname": new_name,
        "beforeNicknameSet": sorted(list({str(x.get('nickname', '')) for x in before_rows})),
        "afterNicknameSet": sorted(list({str(x.get('nickname', '')) for x in after_rows})),
        "beforeCount": len(before_rows),
        "afterCount": len(after_rows),
        "beforeImage": before_img,
        "afterImage": after_img,
        "generatedAt": datetime.now().isoformat(),
    }
    with open(data_file, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    print(json.dumps(payload, ensure_ascii=False))


if __name__ == "__main__":
    main()
