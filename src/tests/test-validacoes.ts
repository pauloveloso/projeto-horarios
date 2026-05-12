// src/tests/test-validacoes.ts
import { salvarAulaComValidacoes } from "@/app/(admin)/lancamentos/actions";
import { sql } from "@vercel/postgres";

async function executarTestes() {
  console.log("🧪 Iniciando testes do motor de validações...\n");

  // Buscar IDs necessários para os testes
  const versaoResult =
    await sql`SELECT id FROM versoes_grade WHERE ativa = true LIMIT 1`;
  const versaoId = versaoResult.rows[0]?.id;

  const turmaResult = await sql`SELECT id FROM turmas LIMIT 1`;
  const turmaId = turmaResult.rows[0]?.id;

  const disciplinaResult = await sql`SELECT id FROM disciplinas LIMIT 1`;
  const disciplinaId = disciplinaResult.rows[0]?.id;

  const professorResult = await sql`SELECT id FROM professores LIMIT 1`;
  const professorId = professorResult.rows[0]?.id;

  const espacoResult = await sql`SELECT id FROM espacos LIMIT 1`;
  const espacoId = espacoResult.rows[0]?.id;

  const slotResult =
    await sql`SELECT id FROM slots_horarios WHERE hora_inicio = '07:30' LIMIT 1`;
  const slot1Id = slotResult.rows[0]?.id;

  const slot2Result =
    await sql`SELECT id FROM slots_horarios WHERE hora_inicio = '08:20' LIMIT 1`;
  const slot2Id = slot2Result.rows[0]?.id;

  if (
    !versaoId ||
    !turmaId ||
    !disciplinaId ||
    !professorId ||
    !espacoId ||
    !slot1Id ||
    !slot2Id
  ) {
    console.error("❌ Dados insuficientes no banco para realizar os testes");
    return;
  }

  console.log("✅ Dados carregados para teste");
  console.log(
    `Versão: ${versaoId}, Turma: ${turmaId}, Disciplina: ${disciplinaId}`,
  );
  console.log(
    `Professor: ${professorId}, Espaço: ${espacoId}, Slots: ${slot1Id}, ${slot2Id}\n`,
  );

  // Teste 1: Aula normal (sem conflitos)
  console.log("📝 Teste 1: Lançando aula normal (SEGUNDA, 07:30)...");
  let resultado = await salvarAulaComValidacoes({
    turma_id: turmaId,
    disciplina_id: disciplinaId,
    professor_id: professorId,
    espaco_id: espacoId,
    slot_horario_id: slot1Id,
    dia_semana: "SEGUNDA",
    versao_id: versaoId,
  });

  console.log("Resultado:", resultado.success ? "✅ Sucesso" : "❌ Erro");
  if (resultado.validacoes?.length > 0) {
    console.log("Validações encontradas:", resultado.validacoes.length);
    resultado.validacoes.forEach((v) => {
      console.log(`  - [${v.gravidade}] ${v.regra}: ${v.mensagem}`);
    });
  }
  console.log("");

  // Teste 2: Choque de Professor (mesmo professor, mesmo horário, dia diferente)
  console.log(
    "📝 Teste 2: Lançando aula com CHOQUE DE PROFESSOR (TERCA, 07:30)...",
  );
  resultado = await salvarAulaComValidacoes({
    turma_id: turmaId + 1, // Turma diferente
    disciplina_id: disciplinaId,
    professor_id: professorId, // Mesmo professor
    espaco_id: espacoId,
    slot_horario_id: slot1Id, // Mesmo horário
    dia_semana: "TERCA",
    versao_id: versaoId,
  });

  console.log("Resultado:", resultado.success ? "✅ Sucesso" : "❌ Erro");
  if (resultado.validacoes?.length > 0) {
    console.log("Validações encontradas:", resultado.validacoes.length);
    resultado.validacoes.forEach((v) => {
      console.log(`  - [${v.gravidade}] ${v.regra}: ${v.mensagem}`);
    });
  }
  console.log("");

  // Teste 3: Choque de Turma (mesma turma, mesmo horário, mesmo dia)
  console.log(
    "📝 Teste 3: Lançando aula com CHOQUE DE TURMA (SEGUNDA, 07:30)...",
  );
  resultado = await salvarAulaComValidacoes({
    turma_id: turmaId, // Mesma turma
    disciplina_id: disciplinaId + 1, // Disciplina diferente
    professor_id: professorId + 1, // Professor diferente
    espaco_id: espacoId,
    slot_horario_id: slot1Id, // Mesmo horário
    dia_semana: "SEGUNDA", // Mesmo dia
    versao_id: versaoId,
  });

  console.log("Resultado:", resultado.success ? "✅ Sucesso" : "❌ Erro");
  if (resultado.validacoes?.length > 0) {
    console.log("Validações encontradas:", resultado.validacoes.length);
    resultado.validacoes.forEach((v) => {
      console.log(`  - [${v.gravidade}] ${v.regra}: ${v.mensagem}`);
    });
  }
  console.log("");

  // Teste 4: Choque de Espaço (mesmo espaço, mesmo horário, mesmo dia)
  console.log(
    "📝 Teste 4: Lançando aula com CHOQUE DE ESPAÇO (SEGUNDA, 07:30)...",
  );
  resultado = await salvarAulaComValidacoes({
    turma_id: turmaId + 2, // Turma diferente
    disciplina_id: disciplinaId,
    professor_id: professorId + 2, // Professor diferente
    espaco_id: espacoId, // Mesmo espaço
    slot_horario_id: slot1Id, // Mesmo horário
    dia_semana: "SEGUNDA", // Mesmo dia
    versao_id: versaoId,
  });

  console.log("Resultado:", resultado.success ? "✅ Sucesso" : "❌ Erro");
  if (resultado.validacoes?.length > 0) {
    console.log("Validações encontradas:", resultado.validacoes.length);
    resultado.validacoes.forEach((v) => {
      console.log(`  - [${v.gravidade}] ${v.regra}: ${v.mensagem}`);
    });
  }
  console.log("");

  // Teste 5: Descanso Docente (últimos horários de um dia e primeiros do próximo)
  console.log("📝 Teste 5: Lançando aula para testar DESCANSO DOCENTE...");
  // Primeiro lança na sexta às 21:40-22:30
  const slotNoiteSexta =
    await sql`SELECT id FROM slots_horarios WHERE hora_inicio = '21:40' LIMIT 1`;
  const slotNoiteId = slotNoiteSexta.rows[0]?.id;

  if (slotNoiteId) {
    await salvarAulaComValidacoes({
      turma_id: turmaId,
      disciplina_id: disciplinaId,
      professor_id: professorId + 10, // Novo professor
      espaco_id: espacoId,
      slot_horario_id: slotNoiteId,
      dia_semana: "SEXTA",
      versao_id: versaoId,
    });

    // Agora lança na segunda às 07:30-08:20
    resultado = await salvarAulaComValidacoes({
      turma_id: turmaId,
      disciplina_id: disciplinaId,
      professor_id: professorId + 10, // Mesmo professor
      espaco_id: espacoId,
      slot_horario_id: slot1Id, // 07:30
      dia_semana: "SEGUNDA",
      versao_id: versaoId,
    });

    console.log("Resultado:", resultado.success ? "✅ Sucesso" : "❌ Erro");
    if (resultado.validacoes?.length > 0) {
      console.log("Validações encontradas:", resultado.validacoes.length);
      resultado.validacoes.forEach((v) => {
        console.log(`  - [${v.gravidade}] ${v.regra}: ${v.mensagem}`);
      });
    }
  }
  console.log("");

  console.log("🏁 Testes finalizados!");
}

// Executar os testes
executarTestes().catch(console.error);
