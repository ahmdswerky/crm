// <fieldset data-answer="b" data-why="..."> with radio inputs valued a/b/c: instant feedback on choice.
document.querySelectorAll('.quiz fieldset').forEach(set => {
  const feedback = set.appendChild(document.createElement('p'));
  feedback.className = 'feedback';
  feedback.setAttribute('aria-live', 'polite');
  set.addEventListener('change', event => {
    const right = event.target.value === set.dataset.answer;
    set.querySelectorAll('label').forEach(label => label.classList.remove('right', 'wrong'));
    event.target.closest('label').classList.add(right ? 'right' : 'wrong');
    feedback.textContent = (right ? 'Correct. ' : 'Not quite. ') + set.dataset.why;
  });
});
