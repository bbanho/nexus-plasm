# spec.md

## Requisitos
- REQ-PHI-001: calcular Φ por run_id com métricas já disponíveis no run
- REQ-PHI-002: alertar quando H(T) > limiar_entropia (caos)
- REQ-PHI-003: alertar quando I(M;T) < limiar_mi (morte térmica)
- REQ-PHI-004: Φ determinístico e replayable
- REQ-PHI-005: persistir EnergyResult em store queryável

## Restrições
- Sem LLM no cálculo
- Sem alteração de contratos de ingestão existentes
- Determinístico e replayable por run_id

## Critérios de aceite
- [x] compute_phi retorna EnergyResult com phi, alertas e componentes
- [x] Fixture de entropia alta dispara chaos_alert
- [x] Fixture de MI baixa dispara thermal_death_alert
- [x] Reprocessar mesmo run_id produz Φ idêntico
- [x] Resultado persistido e consultável por run_id

## Não-requisitos
- Não reingestionar corpus piloto
- Não alterar schemas existentes
- Não bloquear produção por padrão
