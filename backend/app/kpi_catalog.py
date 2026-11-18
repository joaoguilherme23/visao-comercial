"""
Built-in KPI catalog definitions for WhatsApp conversation reports.

Separated from main.py for readability. Used by the seed function at startup.

Fontes disponíveis (têm cliente_id para isolamento por tenant):
  leads        → integracao.leads
  analises     → analise.analises
  kpi_generico → analise.kpi_generico
  mensagens    → integracao.mensagens

Opções extras em config_calculo:
  skip_ativo_filter (bool) — ignora filtro ativo=True (ex: total_leads conta todos)
  multiplicar (number)     — multiplica resultado final (ex: 100 converte 0–1 em percentual)
"""

BUILTIN_KPIS = [

    # ══════════════════════════════════════════════════════════════════════════
    # LEADS — Volume e qualificação
    # ══════════════════════════════════════════════════════════════════════════

    {
        "slug": "total_leads",
        "nome": "Novos Leads",
        "descricao": "Número total de contatos cadastrados no período (ativos e inativos)",
        "icone": "Users", "cor": "#6366f1",
        "tipo_calculo": "count",
        "config_calculo": {
            "fonte": "leads", "operacao": "count", "filtros": [],
            "skip_ativo_filter": True,
        },
        "formato": "number", "categoria_kpi": "leads", "ordem_padrao": 1,
    },
    {
        "slug": "leads_ativos",
        "nome": "Leads Ativos",
        "descricao": "Contatos ativos (não arquivados)",
        "icone": "UserCheck", "cor": "#22c55e",
        "tipo_calculo": "count",
        "config_calculo": {
            "fonte": "leads", "operacao": "count",
            "filtros": [{"campo": "ativo", "op": "eq", "valor": True}],
        },
        "formato": "number", "categoria_kpi": "leads", "ordem_padrao": 2,
    },
    {
        "slug": "leads_identificados",
        "nome": "Leads Identificados",
        "descricao": "Contatos com nome preenchido — inclui ativos e inativos para comparação com total_leads",
        "icone": "UserCheck", "cor": "#06b6d4",
        "tipo_calculo": "count",
        "config_calculo": {
            "fonte": "leads", "operacao": "count",
            "filtros": [{"campo": "nome", "op": "notnull", "valor": None}],
            "skip_ativo_filter": True,
        },
        "formato": "number", "categoria_kpi": "leads", "ordem_padrao": 4,
    },
    {
        "slug": "leads_sem_etapa",
        "nome": "Leads Sem Etapa",
        "descricao": "Contatos que ainda não foram classificados no funil",
        "icone": "Layers", "cor": "#f59e0b",
        "tipo_calculo": "count",
        "config_calculo": {
            "fonte": "leads", "operacao": "count",
            "filtros": [{"campo": "etapa_funil", "op": "isnull", "valor": None}],
        },
        "formato": "number", "categoria_kpi": "leads", "ordem_padrao": 5,
    },
    {
        "slug": "score_medio",
        "nome": "Score Médio dos Leads",
        "descricao": "Média do score de qualificação dos leads ativos",
        "icone": "Star", "cor": "#eab308",
        "tipo_calculo": "avg",
        "config_calculo": {
            "fonte": "leads", "operacao": "avg", "campo": "score", "filtros": [],
        },
        "formato": "number", "categoria_kpi": "leads", "ordem_padrao": 11,
    },
    {
        "slug": "etapa_mais_comum",
        "nome": "Etapa Mais Comum no Funil",
        "descricao": "Etapa do funil com maior concentração de leads ativos",
        "icone": "Layers", "cor": "#a855f7",
        "tipo_calculo": "mode",
        "config_calculo": {
            "fonte": "leads", "operacao": "mode", "campo": "etapa_funil", "filtros": [],
        },
        "formato": "text", "categoria_kpi": "leads", "ordem_padrao": 12,
    },
    {
        "slug": "origem_mais_comum",
        "nome": "Principal Origem dos Leads",
        "descricao": "Canal de origem mais frequente",
        "icone": "GitBranch", "cor": "#06b6d4",
        "tipo_calculo": "mode",
        "config_calculo": {
            "fonte": "leads", "operacao": "mode", "campo": "origem", "filtros": [],
        },
        "formato": "text", "categoria_kpi": "leads", "ordem_padrao": 13,
    },
    # ══════════════════════════════════════════════════════════════════════════
    # ANÁLISE DE CONVERSA — IA e qualidade das análises
    # ══════════════════════════════════════════════════════════════════════════

    {
        "slug": "score_interesse_medio",
        "nome": "Score de Fechamento Médio",
        "descricao": "Média da probabilidade de fechamento estimada pela IA (0–100%)",
        "icone": "TrendingUp", "cor": "#22c55e",
        "tipo_calculo": "avg",
        "config_calculo": {
            "fonte": "analises", "operacao": "avg",
            "campo": "kpi_score_fechamento", "filtros": [],
            # kpi_score_fechamento vem 0–1 do modelo; multiplicar por 100 para exibir em %
            "multiplicar": 100,
        },
        "formato": "percent", "categoria_kpi": "analise", "ordem_padrao": 22,
    },
    {
        "slug": "sentimento_predominante",
        "nome": "Sentimento Predominante",
        "descricao": "Sentimento mais frequente nas conversas (positivo/neutro/negativo)",
        "icone": "Smile", "cor": "#06b6d4",
        "tipo_calculo": "mode",
        "config_calculo": {
            "fonte": "analises", "operacao": "mode", "campo": "sentimento", "filtros": [],
        },
        "formato": "text", "categoria_kpi": "analise", "ordem_padrao": 23,
    },
    {
        "slug": "intencao_predominante",
        "nome": "Intenção Predominante",
        "descricao": "Intenção de compra mais detectada pela IA",
        "icone": "Target", "cor": "#f59e0b",
        "tipo_calculo": "mode",
        "config_calculo": {
            "fonte": "analises", "operacao": "mode", "campo": "intencao", "filtros": [],
        },
        "formato": "text", "categoria_kpi": "analise", "ordem_padrao": 24,
    },
    {
        "slug": "media_msgs_conversa",
        "nome": "Média de Msgs por Conversa",
        "descricao": "Quantidade média de mensagens trocadas por análise",
        "icone": "MessageSquare", "cor": "#8b5cf6",
        "tipo_calculo": "avg",
        "config_calculo": {
            "fonte": "analises", "operacao": "avg", "campo": "total_msgs", "filtros": [],
        },
        "formato": "number", "categoria_kpi": "analise", "ordem_padrao": 26,
    },
    {
        "slug": "analises_positivas",
        "nome": "Conversas Positivas",
        "descricao": "Conversas com sentimento positivo",
        "icone": "ThumbsUp", "cor": "#22c55e",
        "tipo_calculo": "count",
        "config_calculo": {
            "fonte": "analises", "operacao": "count",
            "filtros": [{"campo": "sentimento", "op": "eq", "valor": "positivo"}],
        },
        "formato": "number", "categoria_kpi": "analise", "ordem_padrao": 29,
    },
    {
        "slug": "analises_negativas",
        "nome": "Conversas Negativas",
        "descricao": "Conversas com sentimento negativo",
        "icone": "ThumbsDown", "cor": "#ef4444",
        "tipo_calculo": "count",
        "config_calculo": {
            "fonte": "analises", "operacao": "count",
            "filtros": [{"campo": "sentimento", "op": "eq", "valor": "negativo"}],
        },
        "formato": "number", "categoria_kpi": "analise", "ordem_padrao": 30,
    },
    {
        "slug": "analises_neutras",
        "nome": "Conversas Neutras",
        "descricao": "Conversas com sentimento neutro",
        "icone": "Minus", "cor": "#94a3b8",
        "tipo_calculo": "count",
        "config_calculo": {
            "fonte": "analises", "operacao": "count",
            "filtros": [{"campo": "sentimento", "op": "eq", "valor": "neutro"}],
        },
        "formato": "number", "categoria_kpi": "analise", "ordem_padrao": 31,
    },
    {
        "slug": "score_fechamento_alto",
        "nome": "Leads com Alto Fechamento",
        "descricao": "Leads com score de fechamento acima de 70% (alta probabilidade de venda)",
        "icone": "CheckCircle2", "cor": "#22c55e",
        "tipo_calculo": "count",
        "config_calculo": {
            "fonte": "analises", "operacao": "count",
            "filtros": [{"campo": "kpi_score_fechamento", "op": "gte", "valor": 0.7}],
        },
        "formato": "number", "categoria_kpi": "analise", "ordem_padrao": 33,
    },
    {
        "slug": "urgencia_predominante",
        "nome": "Urgência Predominante",
        "descricao": "Nível de urgência mais frequente detectado pela IA",
        "icone": "Clock", "cor": "#ef4444",
        "tipo_calculo": "mode",
        "config_calculo": {
            "fonte": "analises", "operacao": "mode", "campo": "kpi_urgencia", "filtros": [],
        },
        "formato": "text", "categoria_kpi": "analise", "ordem_padrao": 34,
    },
    {
        "slug": "leads_urgencia_alta",
        "nome": "Leads — Urgência Alta",
        "descricao": "Leads distintos classificados com urgência alta pela IA no período",
        "icone": "AlertTriangle", "cor": "#ef4444",
        "tipo_calculo": "count",
        "config_calculo": {
            "fonte": "analises", "operacao": "count_distinct", "distinct_campo": "lead_id",
            "filtros": [{"campo": "kpi_urgencia", "op": "eq", "valor": "alta"}],
        },
        "formato": "number", "categoria_kpi": "analise", "ordem_padrao": 35,
    },
    {
        "slug": "leads_urgencia_media",
        "nome": "Leads — Urgência Média",
        "descricao": "Leads distintos classificados com urgência média pela IA no período",
        "icone": "Clock", "cor": "#f97316",
        "tipo_calculo": "count",
        "config_calculo": {
            "fonte": "analises", "operacao": "count_distinct", "distinct_campo": "lead_id",
            "filtros": [{"campo": "kpi_urgencia", "op": "eq", "valor": "media"}],
        },
        "formato": "number", "categoria_kpi": "analise", "ordem_padrao": 36,
    },
    {
        "slug": "leads_urgencia_baixa",
        "nome": "Leads — Urgência Baixa",
        "descricao": "Leads distintos classificados com urgência baixa pela IA no período",
        "icone": "Clock", "cor": "#3b82f6",
        "tipo_calculo": "count",
        "config_calculo": {
            "fonte": "analises", "operacao": "count_distinct", "distinct_campo": "lead_id",
            "filtros": [{"campo": "kpi_urgencia", "op": "eq", "valor": "baixa"}],
        },
        "formato": "number", "categoria_kpi": "analise", "ordem_padrao": 37,
    },

    # ══════════════════════════════════════════════════════════════════════════
    # CONVERSÃO — Taxas e percentuais estratégicos
    # ══════════════════════════════════════════════════════════════════════════

    {
        "slug": "pct_sentimento_positivo",
        "nome": "% Sentimento Positivo",
        "descricao": "Porcentagem de conversas com sentimento positivo",
        "icone": "TrendingUp", "cor": "#22c55e",
        "tipo_calculo": "percent",
        "config_calculo": {
            "fonte": "analises", "operacao": "percent",
            "filtros_numerador": [{"campo": "sentimento", "op": "eq", "valor": "positivo"}],
            "filtros_denominador": [],
        },
        "formato": "percent", "categoria_kpi": "conversao", "ordem_padrao": 40,
    },
    {
        "slug": "pct_leads_fechados",
        "nome": "% Leads Fechados",
        "descricao": "Porcentagem de leads ativos na etapa Fechado",
        "icone": "CheckCircle", "cor": "#22c55e",
        "tipo_calculo": "percent",
        "config_calculo": {
            "fonte": "leads", "operacao": "percent",
            "filtros_numerador": [{"campo": "etapa_funil", "op": "eq", "valor": "Fechado"}],
            "filtros_denominador": [],
        },
        "formato": "percent", "categoria_kpi": "conversao", "ordem_padrao": 41,
    },
    {
        "slug": "pct_leads_perdidos",
        "nome": "% Leads Perdidos",
        "descricao": "Porcentagem de leads ativos na etapa Perdido",
        "icone": "XCircle", "cor": "#ef4444",
        "tipo_calculo": "percent",
        "config_calculo": {
            "fonte": "leads", "operacao": "percent",
            "filtros_numerador": [{"campo": "etapa_funil", "op": "eq", "valor": "Perdido"}],
            "filtros_denominador": [],
        },
        "formato": "percent", "categoria_kpi": "conversao", "ordem_padrao": 42,
    },
    {
        "slug": "pct_leads_identificados",
        "nome": "% Leads Identificados",
        "descricao": "Porcentagem de leads com nome preenchido (qualidade do dado)",
        "icone": "UserCheck", "cor": "#06b6d4",
        "tipo_calculo": "percent",
        "config_calculo": {
            "fonte": "leads", "operacao": "percent",
            "filtros_numerador": [{"campo": "nome", "op": "notnull", "valor": None}],
            "filtros_denominador": [],
        },
        "formato": "percent", "categoria_kpi": "conversao", "ordem_padrao": 43,
    },
    {
        "slug": "pct_interesse_alto",
        "nome": "% Alto Interesse",
        "descricao": "Porcentagem de análises com score de interesse acima de 70%",
        "icone": "Zap", "cor": "#f59e0b",
        "tipo_calculo": "percent",
        "config_calculo": {
            "fonte": "analises", "operacao": "percent",
            # Considera alto interesse se >= 7 em escala 0–10
            "filtros_numerador": [{"campo": "score_interesse", "op": "gte", "valor": 7}],
            "filtros_denominador": [],
        },
        "formato": "percent", "categoria_kpi": "conversao", "ordem_padrao": 46,
    },
    {
        "slug": "pct_fechamento_alto",
        "nome": "% Fechamento Provável",
        "descricao": "Porcentagem de leads com score de fechamento acima de 70%",
        "icone": "Target", "cor": "#22c55e",
        "tipo_calculo": "percent",
        "config_calculo": {
            "fonte": "analises", "operacao": "percent",
            "filtros_numerador": [{"campo": "kpi_score_fechamento", "op": "gte", "valor": 0.7}],
            "filtros_denominador": [],
        },
        "formato": "percent", "categoria_kpi": "conversao", "ordem_padrao": 47,
    },
    {
        "slug": "pct_alta_urgencia",
        "nome": "% Alta Urgência",
        "descricao": "Porcentagem de leads classificados com urgência alta",
        "icone": "AlertTriangle", "cor": "#ef4444",
        "tipo_calculo": "percent",
        "config_calculo": {
            "fonte": "analises", "operacao": "percent",
            "filtros_numerador": [{"campo": "kpi_urgencia", "op": "eq", "valor": "alta"}],
            "filtros_denominador": [],
        },
        "formato": "percent", "categoria_kpi": "conversao", "ordem_padrao": 48,
    },
    {
        "slug": "pct_media_urgencia",
        "nome": "% Urgência Média",
        "descricao": "Porcentagem de leads classificados com urgência média",
        "icone": "Clock", "cor": "#f97316",
        "tipo_calculo": "percent",
        "config_calculo": {
            "fonte": "analises", "operacao": "percent",
            "filtros_numerador": [{"campo": "kpi_urgencia", "op": "eq", "valor": "media"}],
            "filtros_denominador": [],
        },
        "formato": "percent", "categoria_kpi": "conversao", "ordem_padrao": 49,
    },
    {
        "slug": "pct_baixa_urgencia",
        "nome": "% Urgência Baixa",
        "descricao": "Porcentagem de leads classificados com urgência baixa",
        "icone": "Clock", "cor": "#3b82f6",
        "tipo_calculo": "percent",
        "config_calculo": {
            "fonte": "analises", "operacao": "percent",
            "filtros_numerador": [{"campo": "kpi_urgencia", "op": "eq", "valor": "baixa"}],
            "filtros_denominador": [],
        },
        "formato": "percent", "categoria_kpi": "conversao", "ordem_padrao": 50,
    },

    # ══════════════════════════════════════════════════════════════════════════
    # OPERACIONAL — Volume e composição de mensagens
    # ══════════════════════════════════════════════════════════════════════════

    {
        "slug": "total_mensagens",
        "nome": "Total de Mensagens",
        "descricao": "Total de mensagens recebidas e enviadas",
        "icone": "MessageCircle", "cor": "#6366f1",
        "tipo_calculo": "count",
        "config_calculo": {"fonte": "mensagens", "operacao": "count", "filtros": []},
        "formato": "number", "categoria_kpi": "operacional", "ordem_padrao": 60,
    },
    {
        "slug": "msgs_recebidas",
        "nome": "Mensagens Recebidas",
        "descricao": "Mensagens enviadas pelos clientes (entrada)",
        "icone": "ArrowDownLeft", "cor": "#22c55e",
        "tipo_calculo": "count",
        "config_calculo": {
            "fonte": "mensagens", "operacao": "count",
            "filtros": [{"campo": "direcao", "op": "eq", "valor": "entrada"}],
        },
        "formato": "number", "categoria_kpi": "operacional", "ordem_padrao": 61,
    },
    {
        "slug": "msgs_enviadas",
        "nome": "Mensagens Enviadas",
        "descricao": "Mensagens enviadas pelo bot/atendente (saida)",
        "icone": "ArrowUpRight", "cor": "#6366f1",
        "tipo_calculo": "count",
        "config_calculo": {
            "fonte": "mensagens", "operacao": "count",
            "filtros": [{"campo": "direcao", "op": "eq", "valor": "saida"}],
        },
        "formato": "number", "categoria_kpi": "operacional", "ordem_padrao": 62,
    },

    {
        "slug": "pct_msgs_recebidas",
        "nome": "% Mensagens Recebidas",
        "descricao": "Proporção de mensagens de entrada vs total",
        "icone": "ArrowDownLeft", "cor": "#22c55e",
        "tipo_calculo": "percent",
        "config_calculo": {
            "fonte": "mensagens", "operacao": "percent",
            "filtros_numerador": [{"campo": "direcao", "op": "eq", "valor": "entrada"}],
            "filtros_denominador": [],
        },
        "formato": "percent", "categoria_kpi": "operacional", "ordem_padrao": 68,
    },
    {
        "slug": "pct_msgs_enviadas",
        "nome": "% Mensagens Enviadas",
        "descricao": "Proporção de mensagens de saída vs total (atividade do bot/atendente)",
        "icone": "ArrowUpRight", "cor": "#6366f1",
        "tipo_calculo": "percent",
        "config_calculo": {
            "fonte": "mensagens", "operacao": "percent",
            "filtros_numerador": [{"campo": "direcao", "op": "eq", "valor": "saida"}],
            "filtros_denominador": [],
        },
        "formato": "percent", "categoria_kpi": "operacional", "ordem_padrao": 69,
    },

    # ══════════════════════════════════════════════════════════════════════════
    # COMPORTAMENTO — Padrões temporais e geográficos
    # ══════════════════════════════════════════════════════════════════════════

    {
        "slug": "dia_semana_predominante",
        "nome": "Dia com Mais Contatos",
        "descricao": "Dia da semana com maior volume de mensagens recebidas dos leads",
        "icone": "Clock", "cor": "#6366f1",
        "tipo_calculo": "mode_dia_semana",
        "config_calculo": {"fonte": "mensagens", "operacao": "mode_dia_semana"},
        "formato": "text", "categoria_kpi": "operacional", "ordem_padrao": 80,
    },
    {
        "slug": "regiao_predominante",
        "nome": "Região com Mais Leads",
        "descricao": "Estado/região de origem com maior concentração de leads (via DDD do WhatsApp)",
        "icone": "GitBranch", "cor": "#22c55e",
        "tipo_calculo": "mode_ddd_regiao",
        "config_calculo": {"fonte": "leads", "operacao": "mode_ddd_regiao"},
        "formato": "text", "categoria_kpi": "leads", "ordem_padrao": 15,
    },
    {
        "slug": "horario_medio_resposta",
        "nome": "Horário Médio de Contato dos Leads",
        "descricao": "Hora média do dia em que os leads enviam mensagens (direcao=entrada). Diferente do gráfico /horario-respostas que mostra quando o bot responde.",
        "icone": "Clock", "cor": "#f59e0b",
        "tipo_calculo": "avg_hora_resposta",
        "config_calculo": {"fonte": "mensagens", "operacao": "avg_hora_resposta"},
        "formato": "text", "categoria_kpi": "operacional", "ordem_padrao": 81,
    },
    {
        "slug": "tempo_primeira_resposta",
        "nome": "Tempo Médio de 1ª Resposta",
        "descricao": "Tempo médio entre o cadastro do lead e o primeiro atendimento registrado",
        "icone": "Clock", "cor": "#6366f1",
        "tipo_calculo": "avg_tempo_primeira_resposta",
        "config_calculo": {"fonte": "leads", "operacao": "avg_tempo_primeira_resposta"},
        "formato": "text", "categoria_kpi": "operacional", "ordem_padrao": 82,
    },

    # ══════════════════════════════════════════════════════════════════════════
    # LEADS — Perfil, geografia e recorrência (extraídos pela IA)
    # ══════════════════════════════════════════════════════════════════════════

    {
        "slug": "leads_recorrentes",
        "nome": "Leads Recorrentes",
        "descricao": "Leads identificados como clientes que já compraram ou já tiveram contato anterior",
        "icone": "RefreshCw", "cor": "#8b5cf6",
        "tipo_calculo": "count",
        "config_calculo": {
            "fonte": "leads", "operacao": "count",
            "filtros": [{"campo": "lead_recorrente", "op": "eq", "valor": True}],
        },
        "formato": "number", "categoria_kpi": "leads", "ordem_padrao": 16,
    },
    {
        "slug": "pct_leads_recorrentes",
        "nome": "% Leads Recorrentes",
        "descricao": "Proporção de leads recorrentes (já clientes) vs total de leads ativos",
        "icone": "RefreshCw", "cor": "#8b5cf6",
        "tipo_calculo": "percent",
        "config_calculo": {
            "fonte": "leads", "operacao": "percent",
            "filtros_numerador": [{"campo": "lead_recorrente", "op": "eq", "valor": True}],
            "filtros_denominador": [],
        },
        "formato": "percent", "categoria_kpi": "conversao", "ordem_padrao": 51,
    },
    {
        "slug": "leads_com_followup",
        "nome": "Leads com Follow-up Agendado",
        "descricao": "Leads com data de próximo contato agendada pela IA",
        "icone": "CalendarCheck", "cor": "#f59e0b",
        "tipo_calculo": "count",
        "config_calculo": {
            "fonte": "leads", "operacao": "count",
            "filtros": [{"campo": "followup_em", "op": "notnull", "valor": None}],
        },
        "formato": "number", "categoria_kpi": "leads", "ordem_padrao": 17,
    },
    {
        "slug": "leads_com_cidade",
        "nome": "Leads com Cidade Identificada",
        "descricao": "Leads onde a IA identificou a cidade do contato durante a conversa",
        "icone": "MapPin", "cor": "#64748b",
        "tipo_calculo": "count",
        "config_calculo": {
            "fonte": "leads", "operacao": "count",
            "filtros": [{"campo": "cidade_lead", "op": "notnull", "valor": None}],
        },
        "formato": "number", "categoria_kpi": "leads", "ordem_padrao": 18,
    },
    {
        "slug": "perfil_lead_predominante",
        "nome": "Perfil de Lead Mais Comum",
        "descricao": "Tipo de perfil comportamental mais frequente entre os leads (ex: pesquisador, impulsivo)",
        "icone": "UserCog", "cor": "#06b6d4",
        "tipo_calculo": "mode",
        "config_calculo": {
            "fonte": "leads", "operacao": "mode", "campo": "perfil_lead", "filtros": [],
        },
        "formato": "text", "categoria_kpi": "leads", "ordem_padrao": 19,
    },
    {
        "slug": "cidade_predominante",
        "nome": "Cidade com Mais Leads",
        "descricao": "Cidade com maior concentração de leads (extraída pela IA das conversas)",
        "icone": "MapPin", "cor": "#22c55e",
        "tipo_calculo": "mode",
        "config_calculo": {
            "fonte": "leads", "operacao": "mode", "campo": "cidade_lead", "filtros": [],
        },
        "formato": "text", "categoria_kpi": "leads", "ordem_padrao": 20,
    },
    {
        "slug": "estado_predominante",
        "nome": "Estado com Mais Leads (IA)",
        "descricao": "Estado mais citado nas conversas (extraído pela IA) — complementa o KPI de região por DDD",
        "icone": "Map", "cor": "#22c55e",
        "tipo_calculo": "mode",
        "config_calculo": {
            "fonte": "leads", "operacao": "mode", "campo": "estado_lead", "filtros": [],
        },
        "formato": "text", "categoria_kpi": "leads", "ordem_padrao": 21,
    },
    {
        "slug": "genero_predominante",
        "nome": "Gênero Predominante",
        "descricao": "Gênero mais frequente entre os leads (inferido pela IA a partir das conversas)",
        "icone": "Users", "cor": "#a855f7",
        "tipo_calculo": "mode",
        "config_calculo": {
            "fonte": "analises", "operacao": "mode", "campo": "extra_json.genero", "filtros": [],
        },
        "formato": "text", "categoria_kpi": "leads", "ordem_padrao": 25,
    },

    # ══════════════════════════════════════════════════════════════════════════
    # ANÁLISE — Oportunidades, perdas e melhorias (gerados pela IA)
    # ══════════════════════════════════════════════════════════════════════════

    {
        "slug": "leads_oportunidade_aberta",
        "nome": "Oportunidades Abertas",
        "descricao": "Leads com oportunidade concreta de negócio identificada pela IA",
        "icone": "TrendingUp", "cor": "#22c55e",
        "tipo_calculo": "count",
        "config_calculo": {
            "fonte": "analises", "operacao": "count",
            "filtros": [{"campo": "extra_json.oportunidade_aberta", "op": "eq", "valor": True}],
        },
        "formato": "number", "categoria_kpi": "analise", "ordem_padrao": 35,
    },
    {
        "slug": "motivo_nao_fechamento_predominante",
        "nome": "Principal Motivo de Perda",
        "descricao": "Motivo mais frequente pelo qual negócios não foram fechados",
        "icone": "XCircle", "cor": "#ef4444",
        "tipo_calculo": "mode",
        "config_calculo": {
            "fonte": "analises", "operacao": "mode",
            "campo": "extra_json.motivo_nao_fechamento", "filtros": [],
        },
        "formato": "text", "categoria_kpi": "analise", "ordem_padrao": 36,
    },
    {
        "slug": "melhoria_atendimento_freq",
        "nome": "Melhoria de Atendimento Mais Sugerida",
        "descricao": "Sugestão de melhoria no atendimento mais frequente identificada pela IA nas conversas",
        "icone": "MessageSquare", "cor": "#06b6d4",
        "tipo_calculo": "mode",
        "config_calculo": {
            "fonte": "analises", "operacao": "mode",
            "campo": "extra_json.melhoria_atendimento", "filtros": [],
        },
        "formato": "text", "categoria_kpi": "analise", "ordem_padrao": 37,
    },
]

# Slugs desativados no startup — temperatura já tem painel fixo no dashboard,
# não faz sentido como card configurável
DEPRECATED_SLUGS = {
    "leads_quentes",
    "leads_mornos",
    "leads_frios",
    "leads_sem_temperatura",
    "temperatura_mais_comum",
    "pct_leads_quentes",
    "pct_temperatura_quente",
    # Mensagens por tipo — removidos por não terem dados significativos
    "msgs_texto",
    "msgs_audio",
    "msgs_imagem",
    "msgs_video",
    "msgs_midia",
    "pct_msgs_audio",
}
