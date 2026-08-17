# tasks.md

## Task 1 — Calculadora Φ
- Descrição: implementar compute_phi determinística
- Arquivos: src/energy.py, tests/energy_test.py, artifacts/fixtures/*.json
- Comando: python -m unittest discover -s tests -p 'energy_test.py'
- DoD: testes passam; determinismo comprovado

## Task 2 — Fixtures e testes
- Descrição: criar fixtures normal, caos, morte térmica e testes associados
- Arquivos: tests/energy_test.py, artifacts/fixtures/*.json
- Comando: python -m unittest discover -s tests -p 'energy_test.py'
- DoD: 3 cenários cobrem alertas e caso normal

## Task 3 — Evidência e auditoria
- Descrição: preencher evidence.md e validar DoD
- Arquivos: evidence.md, decisions.md, risks.md
- Comando: python scripts/validate-ledger.py changes/nexus-energy
- DoD: evidência preenchida; validação verde
