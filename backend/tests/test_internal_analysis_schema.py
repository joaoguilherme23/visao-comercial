"""Testes sem dependência de banco para os contratos internos de análise."""

import os
import unittest
from datetime import datetime, timezone

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost/test")
os.environ.setdefault("DATABASE_URL_SYNC", "postgresql://test:test@localhost/test")

from pydantic import ValidationError

from app.models.lead import Lead
from app.schemas.internal_analysis import AnalysisContextOut, AnalysisResultInput, ContextMessage
from app.services.analysis_provider import _prompts
from app.services.analysis_queue import _apply_legacy_lead_progression


def _valid_result() -> dict:
    return {
        "resumo_curto": "Lead pediu uma proposta.",
        "sentimento": "positivo",
        "score_interesse": 8,
        "intencao": "solicitar_proposta",
        "proximo_passo": "Enviar proposta.",
        "extra": {"frases_ditas_lead": [], "frases_chave_negativas": []},
        "kpi": {"dados": {"origem": "whatsapp"}},
    }


class AnalysisResultSchemaTests(unittest.TestCase):
    def test_rejeita_escopo_enviado_pelo_workflow(self) -> None:
        payload = _valid_result()
        payload["cliente_id"] = "00000000-0000-0000-0000-000000000001"
        with self.assertRaises(ValidationError):
            AnalysisResultInput.model_validate(payload)

    def test_rejeita_score_fora_do_intervalo(self) -> None:
        payload = _valid_result()
        payload["score_interesse"] = 10.01
        with self.assertRaises(ValidationError):
            AnalysisResultInput.model_validate(payload)

    def test_aceita_campos_de_kpi_limitados(self) -> None:
        parsed = AnalysisResultInput.model_validate(_valid_result())
        self.assertEqual(parsed.kpi.dados, {"origem": "whatsapp"})

    def test_normaliza_score_de_interesse_em_escala_de_probabilidade(self) -> None:
        payload = _valid_result()
        payload["score_interesse"] = 0.8
        parsed = AnalysisResultInput.model_validate(payload, strict=True)
        self.assertEqual(parsed.score_interesse, 8)

    def test_rejeita_score_de_fechamento_fora_da_escala_de_probabilidade(self) -> None:
        payload = _valid_result()
        payload["kpi"] = {"score_fechamento": 1.01}
        with self.assertRaises(ValidationError):
            AnalysisResultInput.model_validate(payload)

    def test_aplica_progressao_deterministica_do_lead(self) -> None:
        lead = Lead(
            cliente_id="00000000-0000-0000-0000-000000000001",
            numero_bot_id="00000000-0000-0000-0000-000000000002",
            whatsapp="5511999999999",
            etapa_funil="Novo",
        )
        payload = _valid_result()
        payload.update({"score_interesse": 0.9, "kpi": {"score_fechamento": 0.9}})
        result = AnalysisResultInput.model_validate(payload, strict=True)
        _apply_legacy_lead_progression(lead, result)
        self.assertEqual(lead.temperatura, "quente")
        self.assertEqual(lead.etapa_funil, "Fechamento")
        self.assertEqual(result.score_interesse, 9)

    def test_prompt_aplica_instrucao_e_campos_do_nicho(self) -> None:
        context = AnalysisContextOut(
            job_id="00000000-0000-0000-0000-000000000001",
            tenant={"nome": "Empresa Sintetica", "nome_agente": "Assistente"},
            numero={},
            lead={"nome": "Contato", "etapa_funil": "Novo", "score": 3},
            niche={
                "label": "Teste", "prompt_base": "Priorize a informacao declarada.",
                "campos_kpi": [{"nome": "canal", "tipo": "string"}],
                "campos_analise": [{"nome": "perfil", "tipo": "string"}],
            },
            messages=[ContextMessage(
                direction="entrada", kind="texto", content="Mensagem sintetica",
                sent_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
            )],
        )
        system, user = _prompts(context)
        self.assertIn("Priorize a informacao declarada.", system)
        self.assertIn('"canal"', system)
        self.assertIn('"perfil"', system)
        self.assertIn("Agente Virtual: Assistente", user)
        self.assertIn("[Contato]", user)
