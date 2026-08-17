# proposal.md

## Problema
O NEXUS não tem termostato global. Sem Φ, ele tende a dois modos de falha: caos e morte térmica.

## Escopo
- Definir Φ como função determinística por run
- Criar 3 indicadores operacionais compostos
- Alertar em desvio, sem alterar contratos de ingestão existentes

## Não inclui
- LLM no cálculo
- Mudança de schemas Qdrant/T4 existentes
- Reingestionamento de corpus

## Atores
- Humano: define brief e limiares
- Conductor: cria change e wave plan
- Executor: implementa Φ e testes
- Verificador: preenche evidência

## Riscos
- [x] Limiares fixos podem gerar falsos positivos em corpus pequeno
- [x] Φ não deve bloquear produção sem decisão humana explícita

## Decisões necessárias
- [x] Definir os 3 indicadores operacionais compostos
