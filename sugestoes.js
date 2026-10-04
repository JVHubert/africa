// Banco do botão "Me dá uma ideia", para quem trava na hora de escrever.
export const SUGESTOES = {
  'Objetos': [
    'Guarda-chuva', 'Geladeira', 'Escova de dente', 'Controle remoto', 'Ventilador', 'Liquidificador',
    'Travesseiro', 'Óculos de sol', 'Panela de pressão', 'Cadeado', 'Tesoura', 'Espelho', 'Vassoura',
    'Ferro de passar', 'Mochila', 'Lanterna', 'Relógio', 'Chinelo', 'Abridor de garrafa', 'Varal',
    'Secador de cabelo', 'Martelo', 'Bússola', 'Telescópio', 'Peneira', 'Rede de dormir', 'Marquise',
    'Extintor', 'Carimbo', 'Apito', 'Microondas', 'Saca-rolhas', 'Esponja', 'Fita adesiva', 'Ampulheta',
  ],
  'Comidas': [
    'Pão de queijo', 'Brigadeiro', 'Feijoada', 'Pipoca', 'Coxinha', 'Pastel', 'Churrasco', 'Açaí',
    'Sushi', 'Lasanha', 'Pudim', 'Tapioca', 'Pamonha', 'Cuscuz', 'Moqueca', 'Farofa', 'Quindim',
    'Pizza', 'Hambúrguer', 'Cachorro-quente', 'Melancia', 'Abacaxi', 'Picolé', 'Algodão-doce',
    'Paçoca', 'Ovo de Páscoa', 'Bolo de cenoura', 'Caldo de cana', 'Chimarrão', 'Rapadura',
  ],
  'Animais': [
    'Hipopótamo', 'Ornitorrinco', 'Bicho-preguiça', 'Tamanduá', 'Pinguim', 'Girafa', 'Polvo', 'Camaleão',
    'Tartaruga', 'Morcego', 'Pavão', 'Jacaré', 'Canguru', 'Vaga-lume', 'Cavalo-marinho', 'Tucano',
    'Capivara', 'Coruja', 'Lhama', 'Formiga', 'Golfinho', 'Esquilo', 'Galinha', 'Mico-leão-dourado',
  ],
  'Lugares': [
    'Torre Eiffel', 'Cristo Redentor', 'Pirâmides do Egito', 'Disney', 'Amazônia', 'Pantanal',
    'Lençóis Maranhenses', 'Fernando de Noronha', 'Muralha da China', 'Estátua da Liberdade',
    'Cataratas do Iguaçu', 'Maracanã', 'Polo Norte', 'Deserto do Saara', 'Veneza', 'Hospital',
    'Rodoviária', 'Padaria', 'Cemitério', 'Biblioteca', 'Aeroporto', 'Feira livre', 'Praia', 'Circo',
  ],
  'Famosos e personagens': [
    'Pelé', 'Xuxa', 'Silvio Santos', 'Ayrton Senna', 'Neymar', 'Anitta', 'Faustão', 'Gisele Bündchen',
    'Papai Noel', 'Saci-Pererê', 'Mônica', 'Cebolinha', 'Chaves', 'Seu Madruga', 'Harry Potter',
    'Bob Esponja', 'Mickey Mouse', 'Batman', 'Homem-Aranha', 'Super Mario', 'Pikachu', 'Shrek',
    'Branca de Neve', 'Albert Einstein', 'Mona Lisa', 'Tiradentes', 'Dom Pedro I', 'Elvis Presley',
    'Michael Jackson', 'Cleópatra', 'Napoleão', 'Charles Chaplin', 'Coelhinho da Páscoa', 'Cuca',
  ],
  'Filmes, músicas e TV': [
    'Titanic', 'Rei Leão', 'Frozen', 'Toy Story', 'Procurando Nemo', 'Star Wars', 'Tubarão',
    'O Auto da Compadecida', 'Cidade de Deus', 'Sítio do Picapau Amarelo', 'Malhação', 'Big Brother',
    'Jornal Nacional', 'Novela', 'Carnaval', 'Garota de Ipanema', 'Ilariê', 'Macarena', 'Copa do Mundo',
  ],
  'Ações e situações': [
    'Pular corda', 'Trocar pneu', 'Fazer bolo', 'Pescar', 'Andar de bicicleta', 'Tomar banho de chuva',
    'Ronco', 'Soluço', 'Espirro', 'Engarrafamento', 'Mudança de casa', 'Casamento', 'Aniversário',
    'Dor de dente', 'Arrumar a mala', 'Esconde-esconde', 'Amarelinha', 'Cabo de guerra', 'Selfie',
    'Fila de banco', 'Ressaca', 'Sonambulismo', 'Lavar louça', 'Tirar foto', 'Montar barraca',
  ],
  'Profissões e esportes': [
    'Astronauta', 'Bombeiro', 'Dentista', 'Palhaço', 'Mágico', 'Carteiro', 'Salva-vidas', 'Detetive',
    'Pirata', 'Maestro', 'Goleiro', 'Basquete', 'Surfe', 'Capoeira', 'Xadrez', 'Boliche', 'Sumô',
    'Balé', 'Paraquedismo', 'Esgrima', 'Pingue-pongue', 'Maratona', 'Skate', 'Vôlei de praia',
  ],
};

export const TODAS = Object.entries(SUGESTOES).flatMap(([categoria, lista]) => lista.map((texto) => ({ categoria, texto })));
