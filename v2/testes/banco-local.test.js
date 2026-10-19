import { criarBancoLocal } from "../js/banco/local.js";
import { testarContratoDoBanco } from "./contrato-banco.js";

testarContratoDoBanco("em memória", criarBancoLocal);
