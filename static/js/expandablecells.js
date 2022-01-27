ready(() => {
  const SHOW_DETAILS_TEXT = 'Show details';
  const HIDE_DETAILS_TEXT = 'Hide details';

  const toggleExpandableCellsOnClick = e => {
    const pElement = e.target.parentNode;
    const isPBefore = pElement.classList.contains('expand-toggle-before');
    const tableElement = isPBefore
      ? pElement.nextElementSibling
      : pElement.previousElementSibling;
    const otherPElement = isPBefore
      ? tableElement.nextElementSibling
      : tableElement.previousElementSibling;
    const isCollapsed = tableElement.classList.contains('collapsed');

    if (isCollapsed) {
      tableElement.classList.remove('collapsed');
      pElement.querySelector('a').textContent = HIDE_DETAILS_TEXT;
      otherPElement.querySelector('a').textContent = HIDE_DETAILS_TEXT;
    }
    else {
      tableElement.classList.add('collapsed');
      pElement.querySelector('a').textContent = SHOW_DETAILS_TEXT;
      otherPElement.querySelector('a').textContent = SHOW_DETAILS_TEXT;
    }

    e.preventDefault();
  };

  const createToggleElement = () => {
    const toggleElement = document.createElement('a');
    toggleElement.setAttribute('href', '#');
    toggleElement.textContent = SHOW_DETAILS_TEXT;

    return toggleElement;
  };

  const createToggleContainer = (toggleElement) => {
    const toggleContainer = document.createElement('p');
    toggleContainer.classList.add('expand-toggle');
    toggleContainer.appendChild(toggleElement);

    toggleElement.insertAdjacentHTML('beforebegin', '(');
    toggleElement.insertAdjacentHTML('afterend', ')');

    return toggleContainer;
  };

  document.querySelectorAll('.expandable-cells').forEach(tableElement => {
    tableElement.classList.add('collapsed');

    const toggleElementBefore = createToggleElement();
    const toggleContainerBefore = createToggleContainer(toggleElementBefore);
    toggleContainerBefore.classList.add('expand-toggle-before');
    tableElement.insertAdjacentElement('beforebegin', toggleContainerBefore);
    toggleElementBefore.addEventListener('click', toggleExpandableCellsOnClick, false);

    const toggleElementAfter = createToggleElement();
    const toggleContainerAfter = createToggleContainer(toggleElementAfter);
    toggleContainerAfter.classList.add('expand-toggle-after');
    tableElement.insertAdjacentElement('afterend', toggleContainerAfter);
    toggleElementAfter.addEventListener('click', toggleExpandableCellsOnClick, false);
  });
});
