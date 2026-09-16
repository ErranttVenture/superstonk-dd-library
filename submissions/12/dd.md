# Preserved community submission

Title: Market Makers can sell shares that don't exist, legally.

Author: Doarect

Original source: https://www.justthebros.co/blog/market-maker-locate-exemption/

Submission issue: https://github.com/ErranttVenture/superstonk-dd-library/issues/12

Permission declaration: The submitter confirmed they are the author or have permission to preserve and publicly display this text with attribution.

Copyright remains with the original rights holder. This copy is outside LICENSE-DATA; no new license is granted for the work.

---

July 11, 2026
Market Structure
They Can Sell Shares That Don't Exist — Legally
Reg SHO's locate rule bans selling shares you haven't found — unless you're a market maker. Rule 203(b)(2)(iii), why it exists, and its abuse record.

Updated July 30, 2026

Goose & Gander, Part 1: the market maker locate exemption.

Try to short a stock tomorrow morning. Before your broker will even accept the order, federal law requires them to confirm the shares you're selling actually exist and can be delivered — borrowed, arranged to borrow, or reasonably believed borrowable — and to document it. Every single time.

Now watch a market maker do the same trade. No locate. No borrow. No documentation of where the shares are coming from. They click sell on shares they do not have and have made no arrangement to get, and it is completely legal.

Same market. Same stock. Same trade. Two rulebooks.

This series is about the second rulebook — the one you never got a copy of. Every claim in it links to the rule text, the enforcement record, or the government's own reports. You don't have to trust me. That's the point.

The rule for you
Regulation SHO, Rule 203(b)(1). Before accepting or effecting a short sale in an equity security, a broker-dealer must have:

"(i) Borrowed the security, or entered into a bona-fide arrangement to borrow the security; or (ii) Reasonable grounds to believe that the security can be borrowed so that it can be delivered on the date delivery is due; and (iii) Documented compliance with this paragraph (b)(1)." — [17 CFR § 242.203(b)(1)](https://www.law.cornell.edu/cfr/text/17/242.203)

This is the "locate" requirement. It exists to stop people from selling shares that don't exist. Reasonable! Selling phantom shares inflates the supply of a stock with IOUs, and IOUs push prices around just like real shares do. So the law says: show me the shares first.

The rule for them
Same rule, two paragraphs down. Rule 203(b)(2)(iii) exempts:

"Short sales effected by a market maker in connection with bona-fide market making activities in the security for which this exception is claimed." — [17 CFR § 242.203(b)(2)(iii)](https://www.law.cornell.edu/cfr/text/17/242.203)

That's the whole thing. A market maker engaged in "bona-fide market making" can sell short with no locate at all. The phantom-share problem the locate rule exists to prevent? Waived, for them.

And here's the detail that should bother you: the rule never defines "bona-fide market making." The text just points to the Exchange Act's definition of "market maker" and leaves the boundary of the exemption to SEC guidance and after-the-fact enforcement. The single load-bearing phrase in the exemption is a judgment call.

There's even a small bonus privilege stacked on top: a locate obtained for a short that's covered the same day can be [reused for another short later that day](https://www.finra.org/rules-guidance/guidance/reports/2023-finras-examination-and-risk-monitoring-program/regulation-sho) — one locate, multiple shorts. You don't get that either.

What that buys them: the price, for days at a time
Be precise about what "no locate" means, because this is the part the market-structure crowd mumbles past. Price is set at the margin — whoever makes the next sale sets the tape. A trader who must locate before shorting has a supply constraint: when borrow dries up, they're out of ammunition. A market maker claiming 203(b)(2)(iii) has no such constraint. Every surge of buying can be met with freshly manufactured IOUs, at any size, at whatever price they choose to offer. As long as the exemption holds, the marginal seller can never run dry — which means, in the short term, they don't just participate in price discovery. They can set the price.

Don't take my word for it — the SEC conceded the mechanism while writing the rules. Its 2008 naked-shorting antifraud release warns that fails to deliver can be part of "manipulative 'naked' short selling, which could be used as a tool to drive down a company's stock price," [undermining investor confidence](https://www.sec.gov/files/rules/final/2008/34-58774.pdf). Its September 2008 emergency order — the one that slapped a hard close-out clock on the whole market mid-crisis — cited "possible unnecessary or artificial price movements" and the risk that naked shorting ["may contribute to the disruption of markets."](https://www.sec.gov/files/rules/other/2008/34-58572.pdf) Phantom supply moves prices exactly like real supply, and the exemption is a license to manufacture it on demand.

Now the honest limits, because the record draws them clearly. This is a short-term lever, not a permanent one. [Rule 204](https://www.law.cornell.edu/cfr/text/17/242.204) puts a clock on it: a fail from an ordinary short sale must be closed out by market open on the settlement day after settlement date — and even a fail from bona-fide market making must be closed by the open of the third consecutive settlement day. Every phantom share eventually gets bought back or delivered, and the buyback pushes price the other way. Sell-then-repurchase nets out to roughly nothing — if the window doesn't matter.

But windows are where markets decide things. Days are exactly the timescale on which margin calls fire, options expire, indexes rebalance, and financings price. Hold the price down through the wrong three days and you don't just move a chart — you pick which of those events happen. And the close-out clock that's supposed to keep the window short is precisely what the "reset transactions" below were invented to defeat: roll the fail forward, keep the phantom supply alive, never deliver. That's the line between a liquidity function and a manipulation tool, and the enforcement record shows firms crossing it.

What a few days of price control is worth — in option premiums, expiration pinning, and the "max pain" theory — is its own article, later in this series.

Why they have it — and why you don't
Here's the honest version, because you deserve better than rage-bait.

Why the exemption exists. A market maker's job is to quote both sides of the market, continuously, so that when you hit "buy" there is always someone on the other end. If a market maker gets a buy order and has no inventory, the job requires them to sell you shares they don't have right now and source them after. Make them stop and locate a borrow before every fill, and quoting in tight-borrow names stops working — quotes disappear exactly when you most need someone on the other side, spreads blow out, and everyone pays more on every trade. The exemption is the regulatory price of instant liquidity. That's a real function, and a real benefit, and this series won't pretend otherwise.

Why you're not allowed to have it. Ask the system and the answer comes in respectable regulatory prose: you have no continuous quoting obligation, no net capital requirement, no compliance department. If everyone could sell shares they hadn't located, phantom supply would be unlimited and prices would be fiction. Someone might abuse it.

Read that again. The argument is not that you specifically would fail to deliver. It's that people like you might, so none of you can be trusted. You're presumed careless until proven institutional. Meanwhile the firms that are trusted get policed how? Not up front, like you — nobody checks a market maker's locate before the trade, because there isn't one. They're policed by periodic exams, years after the trades, by a regulator reading their own paperwork.

So the design is: prevention for you, forgiveness for them. Your rulebook assumes you're a risk. Theirs assumes they're good for it.

Which would be easier to swallow if the trusted class stayed inside the lines. They don't.

What it costs you — the receipts
The regulator's own exam reports treat abuse of this exemption as a recurring problem. FINRA's [2024](https://www.finra.org/rules-guidance/guidance/reports/2024-finra-annual-regulatory-oversight-report/regulation-sho) and [2025 Annual Regulatory Oversight Reports](https://www.finra.org/rules-guidance/guidance/reports/2025-finra-annual-regulatory-oversight-report/regulation-sho) both list, as an exam finding, firms "failing to distinguish bona fide market making from ineligible proprietary trading" — in plain English: firms doing ordinary trading for their own book while claiming the no-locate privilege. FINRA even publishes the tells: quoting at the maximum allowable distance from the real market, quoting one side only, quoting only when they're holding a customer order. Fake market making, real exemption.

The SEC has seen worse. Its examination staff [put out a risk alert](https://www.sec.gov/about/offices/ocie/options-trading-risk-alert.pdf) on "reset transactions" — options structures (reverse conversions, buy-writes) used to make a failing short position look delivered without ever delivering anything. Who runs these schemes? Per the SEC's own alert, the activity is "most often done by broker-dealers who claim to rely on the exception to the locate requirement for options market makers found in Rule 203(b)(2)(iii)." The SEC settled a string of cases — Hazan, TJM, the Wolfson brothers — where traders used sham resets and improperly claimed the bona fide market maker exception.

Want scale? In the related optionsXpress case, the SEC's expert found the firm's customers were responsible for [64% of all shares failing to settle in the entire clearing system in the affected stocks](https://www.sec.gov/files/alj/aljdec/2013/id490bpm.pdf) during the period. One customer's single-day trade was 32% of the national volume in Sears. The strategy existed to dodge a 17.2%-per-year borrow fee — the price you would have paid to short honestly. (Precision matters here: optionsXpress wasn't a market maker — that case was a close-out violation, a cousin of this exemption. The Hazan/TJM/Wolfson cases are the locate-exemption ones. The SEC's [enforcement director at the time called the technique](https://www.sec.gov/newsroom/press-releases/2012-2012-66htm) "kiting" shares.)

And when fails pile up badly enough, the rules quietly admit the exemption is the problem: once a stock has been on the threshold list for 13 straight settlement days, [even market makers lose the no-locate privilege](https://www.law.cornell.edu/cfr/text/17/242.203) and must pre-borrow. The emergency brake concedes what the marketing denies — unlocated market-maker shorting produces phantom shares, and sometimes the phantoms swamp the stock.

Two things I will not tell you, because the record doesn't support them: that naked shorting by market makers is rampant and unpunished everywhere (the SEC's own GameStop report found fails in GME spiked but [didn't persist at the clearing-member level](https://www.sec.gov/files/staff-report-equity-options-market-struction-conditions-early-2021.pdf), and most fails settle within days), or that every market maker is running a scam. The documented story is bad enough: a privilege with an undefined boundary, policed after the fact, with a public record of firms crossing the line for profit.

Good for the goose. Good for the gander.

Next in the series: your order never reaches the market — the six firms that buy the right to read retail orders before they print, the dark pool books you'll never see, and the operators who got caught trading on them.

Sources
[17 CFR § 242.203 — Reg SHO borrowing and delivery requirements](https://www.law.cornell.edu/cfr/text/17/242.203) (rule text: locate requirement, MM exemption, threshold-security pre-borrow)
[SEC Division of Trading & Markets, Reg SHO FAQ](https://www.sec.gov/rules-regulations/staff-guidance/trading-markets-frequently-asked-questions-8) (narrow reading of the exemption; indicia of bona fide market making)
[FINRA 2024 Annual Regulatory Oversight Report — Regulation SHO](https://www.finra.org/rules-guidance/guidance/reports/2024-finra-annual-regulatory-oversight-report/regulation-sho)
[FINRA 2025 Annual Regulatory Oversight Report — Regulation SHO](https://www.finra.org/rules-guidance/guidance/reports/2025-finra-annual-regulatory-oversight-report/regulation-sho)
[FINRA 2023 Examination and Risk Monitoring Report — Regulation SHO](https://www.finra.org/rules-guidance/guidance/reports/2023-finras-examination-and-risk-monitoring-program/regulation-sho) (locate reuse)
[SEC OCIE Risk Alert: options trading used to reset Reg SHO close-out obligations (2013)](https://www.sec.gov/about/offices/ocie/options-trading-risk-alert.pdf)
[SEC v. optionsXpress, Initial Decision Rel. No. 490 (ALJ, June 7, 2013)](https://www.sec.gov/files/alj/aljdec/2013/id490bpm.pdf)
[SEC press release 2012-66 (optionsXpress charges)](https://www.sec.gov/newsroom/press-releases/2012-2012-66htm)
[SEC Staff Report on Equity and Options Market Structure Conditions in Early 2021 (Oct 2021)](https://www.sec.gov/files/staff-report-equity-options-market-struction-conditions-early-2021.pdf)
[SEC, "Naked" Short Selling Antifraud Rule — Rule 10b-21 adopting release, Rel. 34-58774 (Oct 2008)](https://www.sec.gov/files/rules/final/2008/34-58774.pdf) (fails to deliver as "a tool to drive down a company's stock price")
[SEC Emergency Order, Rel. 34-58572 (Sept 17, 2008)](https://www.sec.gov/files/rules/other/2008/34-58572.pdf) (market-wide hard close-out imposed over "unnecessary or artificial price movements")
[17 CFR § 242.204 — Rule 204 close-out requirement](https://www.law.cornell.edu/cfr/text/17/242.204) (T+1 close-out for short-sale fails; third-settlement-day deadline for bona-fide market-making fails)