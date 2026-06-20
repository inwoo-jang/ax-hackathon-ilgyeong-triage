import csv, statistics
from collections import defaultdict

SRC = "/Users/inwoo/Downloads/participants.csv"
OUT = "/Users/inwoo/Desktop/AX해커톤/작업/participants_processed.csv"

THRESH = [0.90, 0.70, 0.60, 0.50]          # 수당 구간 경계
KINDS = ["job_training", "work_experience"]
BASE = {"job_training": 150000, "work_experience": 300000}

def pay(kind, rate):
    base = BASE[kind]
    if rate >= .90: return base
    if rate >= .70: return round(base*.875)
    if rate >= .60: return round(base*.75)
    if rate >= .50: return round(base*.625)
    return 0

def band(rate):
    if rate >= .90: return "90%+"
    if rate >= .70: return "70-90%"
    if rate >= .60: return "60-70%"
    if rate >= .50: return "50-60%"
    return "<50% 미지급"

def mask_name(n):
    if len(n) <= 1: return n
    if len(n) == 2: return n[0] + "○"
    return n[0] + "○"*(len(n)-2) + n[-1]

def next_lower_threshold(rate):
    # 현재 rate보다 낮은 가장 가까운 경계선 (이 밑으로 떨어지면 수당 한 칸 하락)
    lowers = [t for t in THRESH if t < rate - 1e-9]
    return max(lowers) if lowers else 0.0

rows = []
with open(SRC, encoding="utf-8") as f:
    r = csv.DictReader(f)
    for row in r:
        rows.append(row)

# melt → (name,kind,period) 구간 출석률
def period_of(wk): return "P1" if wk <= 4 else "P2"

agg = defaultdict(lambda: {"att":0.0,"tot":0.0})
meta = {}
for row in rows:
    name = row["participant_name"]
    code = row["dummy_birth_gender_code"]
    pid = f"{name}|{code}"                     # 이름 중복(이서연x4 등) → 이름+코드 고유키
    meta[pid] = {"name": name, "program": row["program_name"], "code": code}
    for wk in range(1,9):
        for kind in KINDS:
            att = float(row[f"week_{wk:02d}_{kind}_attended_hours"])
            tot = float(row[f"week_{wk:02d}_{kind}_total_hours"])
            key = (pid, kind, period_of(wk))
            agg[key]["att"] += att
            agg[key]["tot"] += tot

# 참여자 단위로 재구성
people = {}
for (pid, kind, period), v in agg.items():
    rate = v["att"]/v["tot"] if v["tot"] else 0.0
    people.setdefault(pid, {})[(kind,period)] = rate

out_records = []
for pid, d in people.items():
    name = meta[pid]["name"]
    rec = {"name": name, "name_masked": mask_name(name),
           "program": meta[pid]["program"], "code": meta[pid]["code"]}
    total_pay_p2 = 0
    total_pay_p1 = 0
    risk = 0.0
    reasons = []
    min_margin = 9
    worst_kind = None
    for kind in KINDS:
        r1 = d.get((kind,"P1"),0.0)
        r2 = d.get((kind,"P2"),0.0)
        p1 = pay(kind, r1); p2 = pay(kind, r2)
        total_pay_p1 += p1; total_pay_p2 += p2
        rec[f"{kind}_P1_rate"] = round(r1,4)
        rec[f"{kind}_P2_rate"] = round(r2,4)
        rec[f"{kind}_P1_band"] = band(r1)
        rec[f"{kind}_P2_band"] = band(r2)
        rec[f"{kind}_P2_pay"] = p2
        # 경계선 여유: P2 기준 다음 하위 경계선까지 거리 (작을수록 위험)
        lower = next_lower_threshold(r2)
        margin = r2 - lower
        # 다음 칸으로 떨어졌을 때 잃는 금액
        loss_if_drop = p2 - pay(kind, max(lower-1e-6,0))
        drop = r1 - r2   # P1 대비 하락폭
        # 위험 가중: 경계 근접(여유 작음) × 손실액 + 하락추세 + 미지급임박
        if r2 > 0:
            prox = max(0.0, 1 - margin/0.20)        # 경계 0.2 이내면 가중 (0~1)
            risk += prox * (loss_if_drop/300000)*100
            if drop > 0.03:
                risk += drop*100
            if r2 < 0.55:                            # 미지급(50%) 임박
                risk += (0.55-r2)*300
        if margin < min_margin:
            min_margin = margin; worst_kind = kind
    rec["total_pay_P1"] = total_pay_p1
    rec["total_pay_P2"] = total_pay_p2
    rec["pay_delta"] = total_pay_p2 - total_pay_p1
    rec["min_margin_to_band"] = round(min_margin,4)
    rec["worst_kind"] = worst_kind
    rec["risk_score"] = round(risk,1)
    out_records.append(rec)

out_records.sort(key=lambda x: -x["risk_score"])

cols = ["name","name_masked","program","code",
        "job_training_P1_rate","job_training_P2_rate","job_training_P1_band","job_training_P2_band","job_training_P2_pay",
        "work_experience_P1_rate","work_experience_P2_rate","work_experience_P1_band","work_experience_P2_band","work_experience_P2_pay",
        "total_pay_P1","total_pay_P2","pay_delta","min_margin_to_band","worst_kind","risk_score"]

import os
os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT,"w",encoding="utf-8",newline="") as f:
    w = csv.DictWriter(f, fieldnames=cols)
    w.writeheader()
    for r in out_records:
        w.writerow({k:r.get(k,"") for k in cols})

# ===== 통계 =====
N = len(out_records)
print(f"참여자 수: {N}")
print(f"가공 CSV 저장: {OUT}")

# 성별
g3 = sum(1 for r in rows if r["dummy_birth_gender_code"].split('-')[1].startswith('3'))
g4 = sum(1 for r in rows if r["dummy_birth_gender_code"].split('-')[1].startswith('4'))
print(f"성별코드 3(여): {g3}, 4(남): {g4}")

# 프로그램 분포
prog = defaultdict(int)
for r in rows: prog[r["program_name"]] += 1
print("프로그램 분포:", dict(sorted(prog.items())))

# 밴드 분포 (P2 기준, kind별)
for kind in KINDS:
    bd = defaultdict(int)
    for r in out_records: bd[r[f"{kind}_P2_band"]] += 1
    print(f"[{kind}] P2 밴드분포:", dict(bd))

# 경계선 ±5%p 밀집 (P2, 90%/70% 경계)
def near(rate, edges=(0.90,0.70,0.60,0.50), tol=0.05):
    return any(abs(rate-e) <= tol for e in edges)
near_cnt = sum(1 for r in out_records
               if near(r["job_training_P2_rate"]) or near(r["work_experience_P2_rate"]))
print(f"P2 경계선 ±5%p 밀집 인원: {near_cnt} ({near_cnt/N*100:.0f}%)")

# P1→P2 하락자 (총수당 기준)
drop_cnt = sum(1 for r in out_records if r["pay_delta"] < 0)
drop_amt = sum(r["pay_delta"] for r in out_records if r["pay_delta"] < 0)
print(f"P1→P2 수당 하락자: {drop_cnt}명, 하락 총액: {drop_amt:,}원")

# 미지급(50%↓) 보유자
unpaid = sum(1 for r in out_records
             if r["job_training_P2_rate"]<0.5 or r["work_experience_P2_rate"]<0.5)
print(f"P2 미지급(50%↓) 구간 보유자: {unpaid}명")

# 수당 총액
tot_p1 = sum(r["total_pay_P1"] for r in out_records)
tot_p2 = sum(r["total_pay_P2"] for r in out_records)
print(f"전체 수당 P1: {tot_p1:,}원 / P2: {tot_p2:,}원 / 차이: {tot_p2-tot_p1:,}원")

# 출석률 평균
all_p2 = [r[f"{k}_P2_rate"] for r in out_records for k in KINDS]
print(f"P2 출석률 평균: {statistics.mean(all_p2)*100:.1f}%, 중앙값: {statistics.median(all_p2)*100:.1f}%")

# Top10 위험자
print("\n=== 위험점수 Top 10 ===")
for r in out_records[:10]:
    print(f"{r['name_masked']:<6} {r['program']:<16} risk={r['risk_score']:<6} "
          f"JT {r['job_training_P1_band']}->{r['job_training_P2_band']} "
          f"WE {r['work_experience_P1_band']}->{r['work_experience_P2_band']} "
          f"수당 {r['total_pay_P1']:,}->{r['total_pay_P2']:,}")
