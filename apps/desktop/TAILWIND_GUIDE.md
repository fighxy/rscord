# Tailwind CSS Guide для RSCord

## Что такое Tailwind CSS?

Tailwind CSS - это utility-first CSS фреймворк, который позволяет быстро создавать современные интерфейсы с помощью готовых CSS классов.

## Преимущества для нашего проекта

1. **Быстрая разработка** - готовые классы для всех основных стилей
2. **Консистентность** - единая система дизайна
3. **Адаптивность** - встроенные breakpoints
4. **Производительность** - только используемые стили попадают в сборку
5. **Современность** - широко используется в индустрии

## Основные классы

### Layout
- `flex` - display: flex
- `grid` - display: grid
- `hidden` - display: none
- `block` - display: block

### Flexbox
- `flex-row` - flex-direction: row
- `flex-col` - flex-direction: column
- `items-center` - align-items: center
- `justify-center` - justify-content: center
- `justify-between` - justify-content: space-between

### Spacing
- `p-4` - padding: 1rem
- `px-4` - padding-left: 1rem; padding-right: 1rem
- `py-2` - padding-top: 0.5rem; padding-bottom: 0.5rem
- `m-2` - margin: 0.5rem
- `mt-4` - margin-top: 1rem
- `mb-2` - margin-bottom: 0.5rem

### Colors
- `text-white` - color: white
- `bg-gray-800` - background-color: #1f2937
- `border-gray-700` - border-color: #374151
- `hover:bg-gray-700` - hover background color

### Typography
- `text-sm` - font-size: 0.875rem
- `text-lg` - font-size: 1.125rem
- `font-medium` - font-weight: 500
- `font-bold` - font-weight: 700
- `text-center` - text-align: center

### Borders & Radius
- `border` - border-width: 1px
- `border-t` - border-top-width: 1px
- `rounded` - border-radius: 0.25rem
- `rounded-lg` - border-radius: 0.5rem
- `rounded-full` - border-radius: 9999px

### Transitions
- `transition-colors` - transition-property: color, background-color, border-color
- `duration-200` - transition-duration: 200ms
- `ease-in-out` - transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1)

## Наши кастомные цвета

```css
/* Discord-like цветовая схема */
discord-blurple: #5865f2
discord-green: #57f287
discord-yellow: #fee75c
discord-fuchsia: #eb459e
discord-red: #ed4245
discord-white: #ffffff
discord-black: #000000
discord-not-quite-black: #23272a
discord-dark-but-not-black: #2c2f33
discord-lighter-dark: #36393f
discord-dark: #2f3136
discord-darker: #202225
```

## Примеры использования

### Кнопка
```jsx
<button className="bg-discord-blurple hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-md transition-colors duration-200">
  Нажми меня
</button>
```

### Карточка
```jsx
<div className="bg-gray-800 rounded-lg shadow-lg border border-gray-700 p-4">
  <h3 className="text-lg font-semibold text-white mb-2">Заголовок</h3>
  <p className="text-gray-300">Содержимое карточки</p>
</div>
```

### Input поле
```jsx
<input 
  className="w-full bg-gray-700 border border-gray-600 text-white placeholder-gray-400 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-discord-blurple focus:border-transparent"
  placeholder="Введите текст..."
/>
```

## Responsive Design

```jsx
<div className="w-full md:w-1/2 lg:w-1/3">
  {/* Адаптивная ширина */}
</div>

<div className="hidden md:block">
  {/* Скрыто на мобильных, показано на средних экранах и больше */}
</div>
```

## Hover и Focus состояния

```jsx
<button className="bg-gray-700 hover:bg-gray-600 focus:ring-2 focus:ring-discord-blurple focus:outline-none">
  Кнопка с hover и focus эффектами
</button>
```

## Полезные ссылки

- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Tailwind CSS Cheat Sheet](https://nerdcave.com/tailwind-cheat-sheet)
- [Tailwind CSS Components](https://tailwindui.com/)

## Советы по разработке

1. **Используйте автодополнение** - VS Code с Tailwind CSS IntelliSense
2. **Группируйте связанные классы** - layout, spacing, colors, etc.
3. **Создавайте компоненты** - для повторяющихся элементов
4. **Используйте @apply** - для сложных кастомных стилей
5. **Думайте в терминах утилит** - вместо создания CSS классов
