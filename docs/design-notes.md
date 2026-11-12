# Design notes

These notes record why two rules exist and which public sources they rest on. They are not agent rules. Results here are mostly from 2025 and 2026 models, and a later model can change them.

Each source is labeled by the kind of evidence it is.

## Collaboration

[rules/quality-collaboration.mdc](../rules/quality-collaboration.mdc) targets these failures:

- Building a change that already exists on another branch, or taking work assigned to someone else.
- Changing a shared contract, or rewriting someone else's section of a shared document, without agreement.
- Committing on the default branch, or opening one large pull request from a stale checkout.
- Writing CI that does not match the project's workflow, or pushing without checking the run.

The fetch, ownership, and default-branch checks come from seeing an agent do those things in a shared repository. The studies below are the public evidence that the same failures are common.

### Sources

- Empirical study. Ehsani, Pathak, and others, "Where Do AI Coding Agents Fail?", Mining Software Repositories, published 31 July 2026. Of 33,596 agent-authored pull requests, the authors annotated 600 rejected ones. Duplicate pull requests were 142 of that sample (23%). CI or test failure was 99 (17%). Pull requests that were not merged tended to change more lines and more files than merged ones (Cliff's delta of 17% for lines and 10% for files). <https://dl.acm.org/doi/10.1145/3793302.3793579>
- Empirical study. Ogenrwot and Businge, AgenticFlict, arXiv 2604.03551. A merge simulation of 107,026 agent pull requests found a textual conflict with the base branch in 27.67% of them. <https://arxiv.org/html/2604.03551v2>
- Empirical study. Concurrent agent pull requests, arXiv 2607.04697. Among pairs of pull requests open at the same time, pairs from the same agent conflicted 19.8% of the time (119 of 601). Pairs from different agents conflicted 41.7% of the time (48 of 115; 95% interval 33.1% to 50.9%). Pairs from different agents were only 0.5% of all overlapping pairs, so that second rate rests on a small sample. <https://arxiv.org/html/2607.04697v2>

### What would justify a change

Revise the rule if later studies of the same kind of repositories find that duplicate work and concurrent conflicts have become rare. A repository that develops on the default branch can already opt out of the push block with `quality.allowDefaultBranchPush`.

## Delegation

[rules/quality-delegation.mdc](../rules/quality-delegation.mdc) targets these failures:

- Several agents editing overlapping or coupled code, each making decisions the others cannot see.
- A handoff that drops a constraint because the brief never stated it.
- A cheaper model writing the code, or a weaker model reviewing a stronger model's code.
- Treating a subagent's report of edits or tests as proof, without looking at the diff or running the checks.
- A large or risky change that is never reviewed from a clean context.

### Sources

- Vendor data. Anthropic, "How we built our multi-agent research system", June 2025. Parallel subagents beat one agent by 90.2% on an internal research evaluation, and used about 15 times the tokens of a chat. Anthropic reports that most coding tasks have fewer independent parts than research, and that agents are poor at coordinating in real time. This is research, not coding, and it is the vendor's own evaluation. <https://www.anthropic.com/research/multi-agent-research-system>
- Controlled study. "Scaling Inference-Time Compute with Teams of Coding Agents", arXiv 2610.17471. On long software tasks, teams beat a solo agent at 3 to 7 times the cost. Workers used only for planning matched full delegation at about half the cost. Cheap workers that wrote the code lowered the score below the solo agent, and extra implementers stopped helping beyond four. <https://arxiv.org/abs/2610.17471>
- Independent evaluation. Vals AI, "Do Agent Teams Pay Off?", 9 October 2026. GPT 6 Sol and Claude Opus 5.5 each built 50 web apps, alone and as a team, at two effort levels, one run per setup. Teams cost 1.8 to 5.1 times as much. Only one of the four comparisons was a significant gain: Sol at medium effort, up 7.3 points. Opus teams took up to 2.3 times as long. <https://www.vals.ai/blogs/multi-agent-vibe-code-bench>
- Vendor data. Cognition, "Multi-Agents: What's Actually Working". The setups that worked kept writing to one agent and used other agents to read or review. <https://cognition.com/blog/multi-agents-working>
- Vendor data. Cognition, "Making Fable Cheaper Than Opus", 13 July 2026. On 3,000 runs of FrontierCode 1.1, Fable 5 leading a cheaper helper cut cost 54% against Fable alone (60.7 versus 60.8). The briefs that worked stated constraints, edge cases, and a definition of done. On one task, a constraint the lead never wrote down was lost: the lead's own code scored 25, and the brief that stated the constraint scored 94. Forcing a model to delegate more made results worse. Opus 4.8 leading the same helper scored below Opus alone. <https://cognition.com/blog/making-fable-cheaper-than-opus>
- Small independent test. "I gave Opus a cheap coder to save money", 12 hard coding tasks. Opus 5.5 alone passed 81% at $1.20 per task. Opus paired with a cheaper writer averaged 55% (the best team reached 69%) at $1.25. The author reports a margin of about 20 points, so differences under 10 points are noise. <https://ibragim.dev/writing/agent-teams-vs-one-opus/>
- Controlled study. "Cross-Model LLM Code Review", arXiv 2607.21656. On 116 LiveCodeBench tasks, Claude Opus 4.7 reviewing Codex GPT-5.5 drafts raised the pass rate from 71.6% to 89.7%. Codex reviewing Opus drafts lowered it from 91.4% to 82.8%. <https://arxiv.org/html/2607.21656>
- Controlled study. "When Does a Second Model Help?", arXiv 2610.01471. On 30 artifacts with 150 planted errors, a fresh session of the same strong model reviewed about as well as a top model from another provider. A weaker reviewer added nothing. One same-model review plus one cross-model review matched 56.7% of the planted errors, against 42.7% for two same-model reviews. <https://arxiv.org/html/2610.01471v1>
- Product documentation. Cursor's subagent docs. Each subagent has its own context, and running several at once multiplies token use. The product already sends broad code search to a faster explore subagent, so the delegation rule does not repeat that. <https://cursor.com/docs/subagents>

### What would justify a change

Revise the rule if a later study shows that a cheaper model writes code as well as the parent, that a weaker model improves a stronger model's code in review, or that several agents can edit shared files at once without conflicting decisions. Until then, search and scouting may use a faster model, and writing stays with the parent unless the user configured a cheaper writer.
