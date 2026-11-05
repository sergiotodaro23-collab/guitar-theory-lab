# GitHub e release

## Primo collegamento

Con GitHub CLI autenticata, dalla cartella del progetto:

```bash
gh repo create guitar-theory-lab --private --source=. --remote=origin --push
git push origin --tags
```

Se parti dal bundle consegnato:

```bash
git clone guitar-theory-lab.bundle guitar-theory-lab
cd guitar-theory-lab
git remote remove origin
```

## Protezione di main

Disponibile sui repository privati solo con un piano a pagamento: su GitHub Free la chiamata risponde 403.

```bash
gh api -X PUT repos/{owner}/guitar-theory-lab/branches/main/protection --input - <<'JSON'
{
  "required_status_checks": { "strict": true, "contexts": ["verify"] },
  "enforce_admins": false,
  "required_pull_request_reviews": null,
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
JSON
```

## Flusso di lavoro

1. `git switch -c feature/nome`
2. Commit piccoli e verificabili, con `npm run check` verde.
3. Pull request verso `main`: la CI esegue lint, type-check, test, build ed e2e.

## Release

```bash
npm version minor        # aggiorna package.json e crea il tag
git push origin main --tags
npm run build:single     # file da allegare alla release
gh release create v0.2.0 dist/guitar-theory-lab.html --generate-notes
```

## Rollback

- Codice: `git revert <commit>` su un branch, poi pull request. Niente force push su `main`.
- Versione funzionante: `git switch --detach v0.1.0 && npm ci && npm run build:single`.
- Dati: i preset hanno `SCHEMA_VERSION`. Un cambio di schema deve aggiungere una migrazione in `src/persistence/presets.ts`: i dati di una versione sconosciuta vengono ignorati, non cancellati, finché l'utente non salva di nuovo.

## Segreti

L'app non usa credenziali né variabili d'ambiente, quindi non c'è `.env.example`. `.gitignore` esclude comunque i file `.env`.
