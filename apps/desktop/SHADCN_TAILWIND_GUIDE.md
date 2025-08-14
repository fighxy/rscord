# shadcn/ui + Tailwind CSS Guide для RSCord

## 🎯 Что такое shadcn/ui?

shadcn/ui - это коллекция переиспользуемых компонентов, построенных на основе Radix UI и Tailwind CSS. Это НЕ библиотека компонентов, а набор копируемых компонентов, которые вы можете настроить под свои нужды.

## ✨ Преимущества интеграции shadcn/ui + Tailwind:

1. **Готовые компоненты** - кнопки, формы, модалы, dropdowns
2. **Консистентный дизайн** - все компоненты следуют единому стилю
3. **Доступность (a11y)** - встроенная поддержка ARIA, клавиатурной навигации
4. **Темная/светлая тема** - автоматическое переключение через CSS переменные
5. **TypeScript поддержка** - полная типизация компонентов
6. **Кастомизация** - легко изменять через Tailwind классы

## 🚀 Установленные компоненты:

### Button
```tsx
import { Button } from "@/components/ui/button";

// Различные варианты
<Button variant="default">Основная кнопка</Button>
<Button variant="destructive">Опасное действие</Button>
<Button variant="outline">Контурная кнопка</Button>
<Button variant="ghost">Призрачная кнопка</Button>
<Button variant="link">Ссылка-кнопка</Button>

// Размеры
<Button size="sm">Маленькая</Button>
<Button size="default">Обычная</Button>
<Button size="lg">Большая</Button>
<Button size="icon">Иконка</Button>
```

### Input
```tsx
import { Input } from "@/components/ui/input";

<Input 
  placeholder="Введите текст..."
  className="bg-gray-700 border-gray-600 text-white"
/>
```

### Avatar
```tsx
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

<Avatar className="w-8 h-8">
  <AvatarImage src="/path/to/image.jpg" alt="User" />
  <AvatarFallback className="bg-discord-blurple text-white">
    {user.displayName?.charAt(0).toUpperCase() || 'U'}
  </AvatarFallback>
</Avatar>
```

### Badge
```tsx
import { Badge } from "@/components/ui/badge";

<Badge variant="default">Обычный</Badge>
<Badge variant="secondary">Вторичный</Badge>
<Badge variant="destructive">Опасный</Badge>
<Badge variant="outline">Контурный</Badge>
```

### Dialog
```tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

<Dialog>
  <DialogTrigger asChild>
    <Button>Открыть диалог</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Заголовок диалога</DialogTitle>
    </DialogHeader>
    <p>Содержимое диалога</p>
  </DialogContent>
</Dialog>
```

### Dropdown Menu
```tsx
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="outline">Открыть меню</Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem>Пункт 1</DropdownMenuItem>
    <DropdownMenuItem>Пункт 2</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

## 🎨 Кастомизация компонентов:

### Через className
```tsx
<Button 
  className="bg-discord-blurple hover:bg-blue-600 text-white rounded-full"
  variant="ghost"
>
  Кастомная кнопка
</Button>
```

### Через variant
```tsx
// В button.tsx можно добавить новые варианты
const buttonVariants = cva(
  "inline-flex items-center justify-center...",
  {
    variants: {
      variant: {
        discord: "bg-discord-blurple hover:bg-blue-600 text-white",
        // ... другие варианты
      }
    }
  }
)
```

## 🔧 Структура проекта:

```
src/
├── components/
│   └── ui/           # shadcn/ui компоненты
│       ├── button.tsx
│       ├── input.tsx
│       ├── avatar.tsx
│       └── ...
├── lib/
│   └── utils.ts      # Утилиты (cn функция)
└── modules/          # Ваши модули
    ├── layout/
    ├── auth/
    └── ...
```

## 📱 Адаптивность:

```tsx
// Компоненты автоматически адаптивны
<Button className="w-full md:w-auto">
  Адаптивная кнопка
</Button>

<Input className="w-full sm:w-80" />
```

## 🎭 Темы:

shadcn/ui автоматически поддерживает темную/светлую тему через CSS переменные:

```css
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --primary: 222.2 47.4% 11.2%;
  /* ... другие переменные */
}

.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
  /* ... темная тема */
}
```

## 🚀 Добавление новых компонентов:

```bash
npx shadcn@latest add [component-name]
```

Доступные компоненты:
- `card` - карточки
- `form` - формы с валидацией
- `toast` - уведомления
- `table` - таблицы
- `tabs` - вкладки
- `select` - выпадающие списки
- `textarea` - многострочные поля
- `checkbox` - чекбоксы
- `radio-group` - группы радиокнопок

## 💡 Лучшие практики:

1. **Используйте variants** - для разных состояний компонентов
2. **Комбинируйте с Tailwind** - для кастомизации
3. **Сохраняйте консистентность** - используйте одинаковые размеры и отступы
4. **Добавляйте анимации** - через Tailwind transition классы
5. **Тестируйте доступность** - компоненты уже оптимизированы

## 🔗 Полезные ссылки:

- [shadcn/ui Documentation](https://ui.shadcn.com/)
- [Radix UI](https://www.radix-ui.com/)
- [Tailwind CSS](https://tailwindcss.com/)
- [class-variance-authority](https://cva.style/docs)

## 🎯 Примеры использования в RSCord:

### Кнопка сервера
```tsx
<Button
  variant="ghost"
  size="icon"
  className="w-12 h-12 bg-discord-blurple hover:bg-blue-600 text-white rounded-full"
>
  🏠
</Button>
```

### Поле поиска
```tsx
<Input
  placeholder="Поиск участников..."
  className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
/>
```

### Аватар пользователя
```tsx
<Avatar className="w-8 h-8">
  <AvatarFallback className="bg-discord-blurple text-white">
    {user.displayName?.charAt(0).toUpperCase()}
  </AvatarFallback>
</Avatar>
```

Теперь у вас есть мощная комбинация Tailwind CSS + shadcn/ui для создания профессионального Discord-подобного интерфейса! 🎉
