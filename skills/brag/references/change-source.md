# Step 0: Gather the change

For a **feature brag** or a **before and after**. Do this before reading the rest of the
project, and write everything you learn to `<output-dir>/change-context.md`. That file
is the source of truth for the whole video, the way the landing page is for a product
demo.

Two rules run through this step:

- **Read the before from the code, never imagine it.** Half the video is the old state.
  Get it from the files as they were before the change.
- **Never disturb the user's working tree.** No `checkout`, no branch switching, no
  stash. Read old and new versions of files straight out of git objects.

## Where is the change? Read it from the prompt

| The prompt says | The change is | How to read it |
|---|---|---|
| a PR link: `github.com/org/repo/pull/42` | that PR | `gh pr view <url>` (works from any folder) |
| "PR #42", "my PR", "this PR" | a PR of the current repo | resolve the repo first (forks, below) |
| "the PR I just opened", "the PR for this branch" | the PR whose head is the current branch | `gh pr view` with no argument |
| a branch name | that branch vs its base | `git merge-base` with the default branch |
| "my last 3 commits", a SHA or a range | those commits | `git show`, `git diff A^..B` |
| "the feature I added here", "this functionality", no link | the current branch vs the default branch, plus uncommitted work if the branch has none | `git merge-base`, `git diff`, `git status` |
| a folder or file ("the new export in src/export/") | that path's change on the branch | `git log -p -- <path>`, `git diff <base>...HEAD -- <path>` |
| several PRs ("PRs 42, 43 and 47") | one video about all of them | see "Several changes, one video" |
| only a description, nothing to diff | what the user describes | read the code as it is now, and the history of those files; mark what came only from the prompt as *requested* |

When it is ambiguous, look at the state of the repo (`git status`, `git log --oneline -10`,
`gh pr status`) and pick the most likely change. Write the assumption into
`change-context.md` and continue; don't stop to ask.

A commit often has a PR behind it, with the problem written down. Find it:

```bash
gh api "repos/<owner>/<repo>/commits/<sha>/pulls" --jq '.[] | "#\(.number) \(.title) \(.html_url)"'
```

## Resolve the repo (forks)

In a fork, `gh pr view 42` looks in the fork, which usually has no PRs, and fails with
`Could not resolve to a PullRequest`. Address the PR unambiguously:

1. **A URL**, if the user gave one: `gh pr view https://github.com/org/repo/pull/42`.
2. **`--repo owner/name`** on every `gh` call, taken from the remote that hosts the PR
   (`git remote -v`: usually `upstream` in a fork, `origin` otherwise).
3. **Bare numbers** only when the clone is not a fork.

Don't run `gh repo set-default`: it changes the user's git config for every future
command.

## Collect the PR (with `gh`)

```bash
gh pr view <pr> --json number,title,body,author,url,state,isDraft,baseRefName,headRefName,baseRefOid,headRefOid,isCrossRepository,additions,deletions,changedFiles,labels,files,commits,closingIssuesReferences
gh pr diff <pr> --name-only
gh pr diff <pr>
gh pr view <pr> --comments          # reviewers often describe the real behavior best
gh issue view <n> --repo <owner/name>   # each linked issue: the problem in the requester's words
```

## Read the files before and after, without touching the working tree

Fetch the PR's head as a bare commit (no local branch is created), then find where it
started:

```bash
git fetch <remote-or-url> pull/<number>/head && HEAD_SHA=$(git rev-parse FETCH_HEAD)
git fetch <remote> <base-branch>
BASE_SHA=$(git merge-base "<remote>/<base-branch>" "$HEAD_SHA")
git show "${HEAD_SHA}:path/to/file.tsx"   # after
git show "${BASE_SHA}:path/to/file.tsx"   # before
```

- Capture `FETCH_HEAD` right away; the next fetch overwrites it.
- The *before* is the merge base, not the current tip of the base branch, so commits
  that landed on main since the PR opened don't leak into the story. If the merge base
  can't be computed (a shallow clone), use the PR's `baseRefOid`.
- Brace the variables before the colon: in zsh `"$BASE:path"` is read as a history
  modifier and eats a character.
- For a branch or commits instead of a PR, use the same `git show "<sha>:<path>"` reads
  with the branch tip and the merge base with the default branch.
- For uncommitted work, the before is `HEAD` and the after is the working tree
  (`git diff HEAD`, and read the files directly).

**No local clone of that repo?** Read files through the API instead of cloning:

```bash
gh api "repos/<owner>/<repo>/contents/<path>?ref=<sha>" --jq .content | base64 -d
```

If you really need a clone, follow the user's repository-location rules (for example
`~/Developer/repos/<repo>`), never inside iCloud-synced folders.

**Without `gh`** (GitLab, Bitbucket, offline): `git fetch`, then
`git diff --stat <base>...<head>`, `git diff <base>...<head>`, and
`git log --oneline <base>..<head>`. The three-dot diff compares against the merge base.
Note in `change-context.md` that the title and description came from commit messages.

**Big diffs:** read the `--stat` first. Lock files, snapshots, generated clients and
vendored folders are not behaviour: set them aside and list them. Then read in full, at
both points, every file that changes what a user can see or do, however many there are,
and list each behaviour it adds or changes under `## Everything it does` in
`change-context.md`. That list is the video's coverage list.

## Find the problem

The feature brag opens with the problem, so find it before anything else. In order of
trust:

1. The linked issue, in the requester's words.
2. The PR description's "why", and the review comments.
3. Commit messages.
4. The code itself: what did a user have to do before (the extra steps, the error, the
   manual workaround)?
5. The user's prompt. If they describe the problem, that is the problem.

Answer these, and keep the answers concrete:

```
1. What changed, in product words?     "Filters now survive a page reload."
2. Who had the problem?                "Support agents working a queue all day."
3. What did it cost them?              "Re-entering five filters after every refresh."
4. What did they do instead?           The workaround, if any.
5. Before, exactly:                    the old screen, message, number or steps, from the before code.
6. After, exactly:                     the new screen, message, number or steps, from the after code.
7. The proof moment:                   the one beat where a viewer goes "oh, that's better".
8. What got better, provably:          counted (3 steps → 1) or shown; numbers only if measured.
9. What the video must NOT claim:      anything adjacent this change did not do.
10. Change class:                      ui-surface / new-flow / behavior-behind-ui / non-visual
11. Everything it does:                every behaviour, surface, edge case and proof: the
                                       coverage list; the video shows all of it.
```

## Changes with no screen

Every change has a surface; find the real one rather than dressing a backend change up
as a UI change.

| Change | Show |
|---|---|
| API endpoint | the request and the response, as formatted JSON, typing in |
| CLI | the terminal: the command typed, the real output, the exit state |
| Performance | the measured number before and after, or the mechanism (the spinner that is gone) if nothing was measured |
| Bug fix | the failing case reproduced, then the same case passing |
| Schema / data | the old payload beside the new one |
| Infra / CI | the pipeline or log, red → green |

Use the real strings from the diff: field names, flags, error text. Never invent a
benchmark. If a change is genuinely undemonstrable (a dependency bump, a pure internal
refactor), say so in `change-context.md`. Then make the most honest video you can from
what it enables, or tell the user a product demo would serve better.

## The honesty rule — and the user's word

Only claim what the change does: no capability outside the changed code, no invented
metrics, nothing "coming soon" dressed up as shipped. If the PR is open, the outro says
`#42 · in review`; if part of it is behind a flag, say which part.

**The user's explicit requests override this.** If they ask to show something the diff
doesn't contain ("also show the export button we're adding next week", "say it's 3×
faster"), do it, and record it in the claims list as *requested*. The rule stops *you*
from overselling; it never blocks the user.

## Several changes, one video

"PRs 42, 43 and 47" make **one** video. Gather each, find the thread that connects them,
and lead with the shared outcome ("Saved views", not "3 PRs shipped"). Give each change
one beat inside the same problem → before → after arc. List all of them in
`change-context.md` and in the outro (`#42 · #43 · #47`). If they have nothing in common,
give each its own problem → before → after beat, one after another, in the order a user
meets them.

## change-context.md

```markdown
# Change: [#42 — title, or branch / commits]

- Source: [PR URL / branch / commits / working tree]   Metadata from: [gh / git only / prompt]
- Repo: [org/repo — note if resolved through upstream in a fork]
- State: [open / draft / merged / unpushed]   Size: +[a] / -[d] across [n] files
- Before point: [sha — merge base]   After point: [sha]
- Assumptions: [how the change was chosen if the prompt was ambiguous]

## The problem
[Who, what it cost them, and the workaround, in their words, with where each fact came from.]

## What changed
[One sentence in product words.]

## Before → after
- Before: [exact old behavior, read from the before files]
- After: [exact new behavior, read from the after files]
- Proof moment: [the beat where the difference lands]
- What got better: [counted or shown; measured numbers only]

## Files that carry the change
- [path] — [what it does in this change]

## Everything it does
[The coverage list: every behaviour the change adds or changes, every surface it touches,
every edge case it now handles, every proof, and any small side change a user would
notice. The video shows every row.]
- [behaviour] — [where a user sees it]

## Not behaviour (set aside while reading)
- [lock files, generated code, vendored folders, refactors with no visible effect]

## Must not claim
- [adjacent things this change did not do]

## Requested by the user
- [anything the prompt asked to show or say beyond the change itself]

## Change class
[ui-surface / new-flow / behavior-behind-ui / non-visual]
```

**Gate:** a product manager who never opened the PR would understand the problem and the
change from this file alone.

## Delivery for a PR

The share copy is for the team (a PR comment, a channel, a sprint review): the outcome
first, the PR reference last. Posting to the PR is outward-facing, so never do it
yourself. Give the user the command, and tell them GitHub accepts the video only by
dragging it into the comment box:

```bash
gh pr comment <pr> --body-file <output-dir>/share-copy.txt
```
