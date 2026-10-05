# SQL test cases

| Case | Expected SQL error (0 = succeeds) |
|---|---|
| T01 booking succeeds | 0 |
| T02 adjacent slots succeed | 0 |
| T03 overlap rejected | 51003 |
| T04 cancelled does not block | 0 |
| T05 outside hours | 51016 |
| T06 inactive member | 51015 |
| T07 expired membership | 51015 |
| T08 maintenance court | 51016 |
| T09 maintenance equipment | 51021 |
| T10 quantity above stock | 51005 |
| T11 stock equality succeeds | 0 |
| T12 combined quantity above stock | 51005 |
| T13 overdue remains occupied | 51005 |
| T14 invalid actual return date | 547 |
| T15 payment XOR | 547 |
| T16 payment amount zero | 547 |
| T17 duplicate transaction reference | 2601 |
| T18 paid total too high | 51007 |
| T19 final amount below paid | 51007 |
| T20 immutable booking snapshot | 51012 |
| T21 catalog changes preserve snapshots | 0 |
| T22 stock reduction rejected | 51005 |
| T23 FK delete preserves history | 547 |
| T24 combined SP creates booking two rentals three payments | 0 |
| T25 SP fails after booking insert and rolls back everything | 51005 |
| T26 multirow booking conflict in inserted rows | 51003 |
| T27 multirow booking update conflict | 51003 |
| T28 multirow rental stock check | 51005 |
| T29 future opening hours protect bookings | 51010 |
| T30 immutable rental snapshot | 51018 |
| T31 actual return frees later days but not same day | 0 |
| T32 inclusive shared day cannot exceed stock | 51005 |
| T33 maintenance XOR rejected | 547 |
| T34 multiple NULL references permitted | 0 |
| T35 blank transaction reference rejected | 547 |
| T36 rental total cannot fall below paid | 51007 |
| T37 disjoint overlaps use peak not sum | 0 |
| T38 membership endpoints allowed | 0 |
| T39 no hard delete transaction history | 51025 |
| T40 free booking produces no payment | 0 |
| T41 inactive facility | 51016 |
| T42 cancellation allowed on unavailable resource | 0 |
| T43 return allowed after equipment disabled | 0 |
| T44 client-supplied snapshot ignored | 0 |
| T45 completed historical rentals do not prevent stock retirement | 0 |
| T46 current stock checks ignore released historical peaks | 0 |
| T47 court 60-minute numerical oracle | 0 |
| T48 planned equipment inclusive two-day numerical oracle | 0 |
| T49 zero usage yields zero percent for both resource types | 0 |
| T50 cancelled court and rental do not contribute usage | 0 |
| T51 early returned rental uses actual return not planned due date | 0 |
| T52 overdue rental occupies all seven days of later week | 0 |
| T53 cross-week returned rental allocates inclusive days to each week | 0 |
| T54 zero equipment stock returns NULL percent without division error | 0 |
| T55 actual return day is included in reported piece-days | 0 |
| T56 actual return day still consumes stock until the next day | 51005 |
| T57 week spine covers both application date boundaries | 0 |
| T58 report view contains all 41 courts and 40 equipment resources | 0 |

ทุก case มี fixtures ใน transaction แยกกันและตรวจจำนวน booking/rental/payment หลัง rollback ของ negative case

T47–T58 เพิ่มจาก Strict Audit: reporting numerical oracles, actual-return inclusivity, full 1900–2099 week coverage และ 81 resources; ต้อง execute บน SQL Server จริง ไม่ถือว่า PASS จากการ parse เพียงอย่างเดียว
